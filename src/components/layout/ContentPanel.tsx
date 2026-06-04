import { useFileListStore } from "../../stores/fileListStore";
import { FileList } from "../files/FileList";
import { FileGrid } from "../files/FileGrid";
import { Loader2, AlertCircle } from "lucide-react";

export function ContentPanel() {
  const loading = useFileListStore((s) => s.loading);
  const error = useFileListStore((s) => s.error);
  const entryCount = useFileListStore((s) => s.visibleEntries.length);
  const viewMode = useFileListStore((s) => s.viewMode);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle size={16} />
          <span className="text-[--font-base]">{error}</span>
        </div>
      </div>
    );
  }

  if (entryCount === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-text-muted text-[--font-base]">This folder is empty</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden">
      {viewMode === "grid" ? <FileGrid /> : <FileList />}
    </div>
  );
}
