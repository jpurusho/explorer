// Native macOS file drag implementation.
//
// Tauri (and the third-party drag plugin) advertise only the modern
// `public.file-url` UTI and lock the source operation to Copy or Move. That
// makes the drag work in Finder/Dock/terminals but get rejected by some
// Electron apps (Claude desktop, etc.) and any destination that only accepts
// Copy. We replicate Finder's behavior:
//
//   1. Each NSPasteboardItem advertises BOTH `public.file-url` (the modern
//      UTI form, what Finder/most native apps read) AND
//      `NSFilenamesPboardType` (the legacy NSPasteboard property-list form,
//      what Electron's webContents.startDrag/drop pipe still keys off).
//   2. Source operation mask = Copy | Move | Generic | Link, so the
//      destination picks whatever it accepts. Dock Trash will pick Move,
//      a chat input will pick Copy.
//
// Implemented with `objc2` + `objc2-app-kit` (already pulled in transitively
// by Tauri), so there is no extra dependency surface.

#![cfg(target_os = "macos")]

use objc2::rc::Retained;
use objc2::runtime::{NSObject, NSObjectProtocol, ProtocolObject};
use objc2::{define_class, msg_send, AnyThread, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{
    NSApp, NSDragOperation, NSDraggingContext, NSDraggingItem, NSDraggingSession,
    NSDraggingSource, NSEvent, NSEventModifierFlags, NSEventType, NSImage, NSPasteboardItem,
    NSView,
};
use objc2_foundation::{
    NSData, NSMutableArray, NSPoint, NSRect, NSSize, NSString, NSURL,
};
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime};

use crate::utils::errors::AppError;

// 1x1 transparent PNG used as the default drag image. macOS overlays its own
// file-drag badge, so the actual image rarely matters.
const DRAG_ICON_PNG_BASE64: &str =
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAJUlEQVR42mNgGAWjYBSMglEwCkbBKBgFo2AUjIJRMApGwSgAAA4cAAGr0p3hAAAAAElFTkSuQmCC";

// objc2's define_class macro needs an ivars type to support set_ivars + init.
// We have nothing per-instance to track, so this is a unit marker.
struct ExplorerDragSourceIvars;

define_class!(
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "ExplorerDragSource"]
    #[ivars = ExplorerDragSourceIvars]
    struct ExplorerDragSource;

    unsafe impl NSObjectProtocol for ExplorerDragSource {}

    unsafe impl NSDraggingSource for ExplorerDragSource {
        // Advertise every operation a destination might accept. Finder does
        // the same — the destination view picks. This is the key to making
        // chat apps (which only accept Copy) work alongside Dock Trash
        // (which only accepts Move).
        #[unsafe(method(draggingSession:sourceOperationMaskForDraggingContext:))]
        unsafe fn dragging_session(
            &self,
            _session: &NSDraggingSession,
            _context: NSDraggingContext,
        ) -> NSDragOperation {
            NSDragOperation::Copy
                | NSDragOperation::Move
                | NSDragOperation::Generic
                | NSDragOperation::Link
        }
    }
);

impl ExplorerDragSource {
    fn new(mtm: MainThreadMarker) -> Retained<Self> {
        let this = Self::alloc(mtm).set_ivars(ExplorerDragSourceIvars);
        unsafe { msg_send![super(this), init] }
    }
}

#[tauri::command]
pub async fn start_native_drag<R: Runtime>(
    app: AppHandle<R>,
    paths: Vec<String>,
) -> Result<(), AppError> {
    if paths.is_empty() {
        return Err(AppError::Other("no paths to drag".to_string()));
    }
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| AppError::Other("main window not found".to_string()))?;

    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();

    app.run_on_main_thread(move || {
        let result = unsafe { start_drag_on_main_thread(&window, paths) };
        let _ = tx.send(result.map_err(|e| e.to_string()));
    })
    .map_err(|e| AppError::Other(format!("run_on_main_thread failed: {}", e)))?;

    rx.recv()
        .map_err(|e| AppError::Other(format!("drag channel recv failed: {}", e)))?
        .map_err(AppError::Other)
}

unsafe fn start_drag_on_main_thread<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
    paths: Vec<String>,
) -> Result<(), String> {
    use base64::Engine;
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};

    let handle = window
        .window_handle()
        .map_err(|e| format!("window handle: {}", e))?;
    let appkit = match handle.as_raw() {
        RawWindowHandle::AppKit(w) => w,
        _ => return Err("not an AppKit window".to_string()),
    };

    let mtm = MainThreadMarker::new()
        .ok_or_else(|| "must run on main thread".to_string())?;

    let ns_view = unsafe { &*(appkit.ns_view.as_ptr() as *const NSView) };
    let ns_window = ns_view
        .window()
        .ok_or_else(|| "view has no window".to_string())?;
    let content_view = ns_window
        .contentView()
        .ok_or_else(|| "window has no contentView".to_string())?;

    let cursor_pos: NSPoint = ns_window.mouseLocationOutsideOfEventStream();

    // Decode the bundled drag image. NSImage::initWithData copies, so we can
    // free the Vec immediately.
    let icon_bytes = base64::engine::general_purpose::STANDARD
        .decode(DRAG_ICON_PNG_BASE64)
        .map_err(|e| format!("decode drag icon: {}", e))?;
    let icon_data = NSData::from_vec(icon_bytes);
    let img = NSImage::initWithData(NSImage::alloc(), &icon_data)
        .ok_or_else(|| "failed to build NSImage".to_string())?;
    let image_size: NSSize = img.size();
    let image_rect = NSRect::new(
        NSPoint::new(
            cursor_pos.x - image_size.width / 2.0,
            cursor_pos.y - image_size.height / 2.0,
        ),
        image_size,
    );

    // Validate paths up front — partial-success drags are confusing.
    for path in &paths {
        if !PathBuf::from(path).exists() {
            return Err(format!("path does not exist: {}", path));
        }
    }

    // Build the legacy NSFilenamesPboardType payload once. It's the XML
    // plist representation of an array of POSIX path strings. We attach
    // this to the FIRST dragging item only, since the legacy convention is
    // a pasteboard-wide list, not per-item.
    let legacy_filenames_data = build_filenames_plist(&paths);
    let legacy_filenames_type = NSString::from_str("NSFilenamesPboardType");
    let public_file_url_type = NSString::from_str("public.file-url");

    let dragging_items: Retained<NSMutableArray<NSDraggingItem>> = NSMutableArray::new();

    for (idx, path) in paths.iter().enumerate() {
        let path_buf = PathBuf::from(path);
        let nsurl = NSURL::fileURLWithPath_isDirectory(
            &NSString::from_str(path),
            path_buf.is_dir(),
        );

        // For each item we author an NSPasteboardItem ourselves so we can
        // attach multiple type representations. The `public.file-url`
        // representation is the URL's absolute-string form (e.g.
        // "file:///Users/me/foo.txt"), stored as UTF-8 bytes — that's the
        // documented Cocoa pasteboard format that Finder, Dock, terminals,
        // and modern Electron all read.
        let item = NSPasteboardItem::new();
        let url_string = nsurl
            .absoluteString()
            .ok_or_else(|| "url has no absoluteString".to_string())?;
        let url_bytes = url_string.to_string().into_bytes();
        let url_data = NSData::from_vec(url_bytes);
        let _: bool = item.setData_forType(&url_data, &public_file_url_type);

        // Attach the legacy plist payload only to the first item. Some
        // Electron apps / older AppKit consumers only call
        // `propertyListForType:NSFilenamesPboardType` once on the first
        // item; the array contains the full file list.
        if idx == 0 {
            let plist_data = NSData::from_vec(legacy_filenames_data.clone());
            let _: bool = item.setData_forType(&plist_data, &legacy_filenames_type);
        }

        let drag_item = NSDraggingItem::initWithPasteboardWriter(
            NSDraggingItem::alloc(),
            &ProtocolObject::from_retained(item),
        );
        drag_item.setDraggingFrame_contents(image_rect, Some(&*img));
        dragging_items.addObject(&*drag_item);
    }

    let current_event = NSApp(mtm).currentEvent();
    let timestamp = current_event.map(|e| e.timestamp()).unwrap_or(0.0);
    let window_number = ns_window.windowNumber();
    let drag_event = NSEvent::mouseEventWithType_location_modifierFlags_timestamp_windowNumber_context_eventNumber_clickCount_pressure(
        NSEventType::LeftMouseDragged,
        cursor_pos,
        NSEventModifierFlags::empty(),
        timestamp,
        window_number,
        None,
        0,
        1,
        1.0,
    )
    .ok_or_else(|| "failed to build drag event".to_string())?;

    let source = ExplorerDragSource::new(mtm);
    // beginDraggingSession retains the source for the lifetime of the
    // session, so we transfer ownership and don't hold a strong reference.
    let _ = content_view.beginDraggingSessionWithItems_event_source(
        &dragging_items,
        &drag_event,
        &ProtocolObject::<dyn NSDraggingSource>::from_retained(source),
    );

    Ok(())
}

// XML-property-list NSData describing an array of POSIX path strings. This
// is the on-pasteboard representation of NSFilenamesPboardType that Electron
// and other legacy consumers expect.
//
// Hand-written rather than pulling in a plist crate: the escape rules are
// minimal because file paths can't contain NUL and we only need to escape
// the five XML characters that can legally appear in a path.
fn build_filenames_plist(paths: &[String]) -> Vec<u8> {
    let mut s = String::with_capacity(256 + paths.iter().map(|p| p.len() + 32).sum::<usize>());
    s.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    s.push_str("<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n");
    s.push_str("<plist version=\"1.0\">\n<array>\n");
    for p in paths {
        s.push_str("<string>");
        for ch in p.chars() {
            match ch {
                '<' => s.push_str("&lt;"),
                '>' => s.push_str("&gt;"),
                '&' => s.push_str("&amp;"),
                '\'' => s.push_str("&apos;"),
                '"' => s.push_str("&quot;"),
                c => s.push(c),
            }
        }
        s.push_str("</string>\n");
    }
    s.push_str("</array>\n</plist>\n");
    s.into_bytes()
}
