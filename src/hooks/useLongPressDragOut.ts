import { useCallback, useEffect, useRef } from "react";
import { startNativeFileDrag } from "../lib/dragOut";

const LONG_PRESS_MS = 350;
const MOVE_TOLERANCE_PX = 5;

/**
 * Hold the primary mouse button still on a draggable item for ~350ms to
 * "lift" it into a native macOS drag (so it can be dropped into Finder, the
 * Dock, other apps). Moving before the timer fires lets the normal HTML5
 * dragstart proceed for in-app moves. We picked long-press over a modifier
 * because every modifier we tried (⌥, ⌘⌥, ⌘⌥+click) collides with macOS
 * window/Dock shortcuts that hide or minimize the destination.
 */
export function useLongPressDragOut() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  const moveListenerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const upListenerRef = useRef<(() => void) | null>(null);
  // Once the long-press fires, the user's mouseup still bubbles to onClick.
  // Suppress clicks for a short window so the release doesn't open/navigate.
  const suppressClickUntilRef = useRef<number>(0);

  const detachListeners = useCallback(() => {
    if (moveListenerRef.current) {
      document.removeEventListener("mousemove", moveListenerRef.current);
      moveListenerRef.current = null;
    }
    if (upListenerRef.current) {
      document.removeEventListener("mouseup", upListenerRef.current);
      upListenerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPos.current = null;
    detachListeners();
  }, [detachListeners]);

  const reset = useCallback(() => {
    cancel();
    firedRef.current = false;
  }, [cancel]);

  // Cleanup if the component unmounts mid-press.
  useEffect(() => () => cancel(), [cancel]);

  const onMouseDown = useCallback((e: React.MouseEvent, getPaths: () => string[]) => {
    if (e.button !== 0) return;
    if (e.metaKey || e.shiftKey || e.altKey) return;
    cancel();
    firedRef.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };

    const onMove = (ev: MouseEvent) => {
      if (!startPos.current) return;
      const dx = ev.clientX - startPos.current.x;
      const dy = ev.clientY - startPos.current.y;
      if (dx * dx + dy * dy > MOVE_TOLERANCE_PX * MOVE_TOLERANCE_PX) {
        cancel();
      }
    };
    const onUp = () => cancel();
    moveListenerRef.current = onMove;
    upListenerRef.current = onUp;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);

    timerRef.current = setTimeout(() => {
      const paths = getPaths();
      console.log("[useLongPressDragOut] Long-press triggered, paths:", paths);
      detachListeners();
      timerRef.current = null;
      startPos.current = null;
      if (paths.length > 0) {
        firedRef.current = true;
        // Block the upcoming click for 500ms so releasing the mouse after
        // the long-press doesn't trigger onClick (which opens the file).
        suppressClickUntilRef.current = Date.now() + 500;
        console.log("[useLongPressDragOut] Calling startNativeFileDrag");
        startNativeFileDrag(paths);
      } else {
        console.warn("[useLongPressDragOut] No paths to drag");
      }
    }, LONG_PRESS_MS);
  }, [cancel, detachListeners]);

  // Components call this from onClick/onDoubleClick. Returns true if the
  // event should be ignored because a long-press just fired.
  const shouldSuppressClick = useCallback((): boolean => {
    return Date.now() < suppressClickUntilRef.current;
  }, []);

  // Caller invokes this from onDragStart. Returns true if native drag has
  // already taken over (so the HTML5 drag should be suppressed).
  const handleDragStart = useCallback((e: React.DragEvent): boolean => {
    if (firedRef.current) {
      e.preventDefault();
      reset();
      return true;
    }
    cancel();
    return false;
  }, [cancel, reset]);

  return { onMouseDown, handleDragStart, shouldSuppressClick };
}
