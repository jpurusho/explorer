import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ImagePreview } from "./ImagePreview";
import { VideoPreview } from "./VideoPreview";
import { AudioPreview } from "./AudioPreview";
import { PdfPreview } from "./PdfPreview";
import { MarkdownPreview } from "./MarkdownPreview";
import { JsonPreview } from "./JsonPreview";
import { YamlPreview } from "./YamlPreview";
import { TextPreview } from "./TextPreview";
import { Editor } from "../editor/Editor";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../stores/settingsStore";
import { useFontThemeStore } from "../../stores/fontThemeStore";
import type { FileContent, FileType } from "../../types";

const editableTypes: FileType[] = ["text", "code", "markdown", "json", "yaml", "unknown"];

export function DetachedPreview() {
  const [content, setContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  useTheme();

  const params = new URLSearchParams(window.location.search);
  const filePath = params.get("path") || "";
  const fileName = params.get("name") || "";
  const fileType = (params.get("type") || "unknown") as FileType;

  useEffect(() => {
    loadSettings().then(() => {
      const settings = useSettingsStore.getState().settings;
      useFontThemeStore.getState().loadTheme(settings.font_theme || "default");
    });
  }, []);

  useEffect(() => {
    if (!filePath) return;

    if (editableTypes.includes(fileType)) {
      setLoading(true);
      invoke<FileContent>("read_file_content", { path: filePath })
        .then(setContent)
        .catch(() => setContent(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [filePath, fileType]);

  const renderContent = () => {
    if (fileType === "image") {
      return <ImagePreview path={filePath} name={fileName} />;
    }

    if (fileType === "video") {
      return <VideoPreview path={filePath} name={fileName} />;
    }

    if (fileType === "audio") {
      return <AudioPreview path={filePath} name={fileName} />;
    }

    if (fileType === "document" && fileName.toLowerCase().endsWith(".pdf")) {
      return <PdfPreview path={filePath} />;
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <span className="text-[var(--font-sm)] text-text-muted">Loading...</span>
        </div>
      );
    }

    if (!content) {
      return (
        <div className="flex items-center justify-center h-full">
          <span className="text-[var(--font-sm)] text-text-muted">No preview available</span>
        </div>
      );
    }

    if (fileType === "markdown") {
      return <MarkdownPreview content={content.content} />;
    }
    if (fileType === "json") {
      return <JsonPreview content={content.content} />;
    }
    if (fileType === "yaml") {
      return <YamlPreview content={content.content} />;
    }

    if (editableTypes.includes(fileType)) {
      return (
        <Editor
          path={filePath}
          content={content.content}
          fileType={fileType}
          fileName={fileName}
        />
      );
    }

    return <TextPreview content={content?.content || ""} truncated={content?.truncated || false} />;
  };

  return (
    <div className="h-screen w-screen bg-bg flex flex-col overflow-hidden">
      <div className="h-8 bg-bg-secondary border-b border-border flex items-center px-4 shrink-0" data-tauri-drag-region>
        <span className="text-[var(--font-sm)] text-text-secondary font-medium truncate">
          {fileName}
        </span>
      </div>
      <div className="flex-1 min-h-0">
        {renderContent()}
      </div>
    </div>
  );
}
