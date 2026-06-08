import { useState, useEffect, useCallback } from "react";
import { check, type Update, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { X, Download, RefreshCw } from "lucide-react";
import { logger } from "../lib/logger";

type UpdateState = "idle" | "available" | "downloading" | "ready" | "error";

export function UpdateNotification() {
  const [state, setState] = useState<UpdateState>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdate();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const checkForUpdate = async () => {
    try {
      const result = await check();
      if (result) {
        logger.info(`Update available: ${result.version}`);
        setUpdate(result);
        setState("available");
      }
    } catch (e) {
      logger.info(`Update check skipped: ${e}`);
    }
  };

  const handleDownloadAndInstall = useCallback(async () => {
    if (!update) return;
    setState("downloading");
    setProgress(0);

    try {
      let totalSize = 0;
      let downloaded = 0;

      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") {
          totalSize = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (totalSize > 0) {
            setProgress(Math.min(100, Math.round((downloaded / totalSize) * 100)));
          }
        } else if (event.event === "Finished") {
          setProgress(100);
        }
      });

      setState("ready");
    } catch (e) {
      logger.error(`Update failed: ${e}`);
      setError(String(e));
      setState("error");
    }
  }, [update]);

  const handleDismiss = () => {
    setDismissed(true);
    update?.close();
  };

  if (state === "idle" || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 bg-bg-secondary border border-border rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <span className="text-[var(--font-sm)] font-medium text-text">
          {state === "available" && "Update Available"}
          {state === "downloading" && "Downloading..."}
          {state === "ready" && "Restart to Update"}
          {state === "error" && "Update Failed"}
        </span>
        {state !== "downloading" && (
          <button onClick={handleDismiss} className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5">
        {state === "available" && (
          <>
            <p className="text-[var(--font-xs)] text-text-muted mb-2.5">
              Version {update?.version} is ready to install.
            </p>
            <button
              onClick={handleDownloadAndInstall}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-[var(--font-sm)] font-medium bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
            >
              <Download size={13} />
              Download & Install
            </button>
          </>
        )}

        {state === "downloading" && (
          <>
            <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full bg-accent transition-[width] duration-200 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[var(--font-xs)] text-text-muted text-center">{progress}%</p>
          </>
        )}

        {state === "ready" && (
          <>
            <p className="text-[var(--font-xs)] text-text-muted mb-2.5">
              Update installed. Restart to apply.
            </p>
            <button
              onClick={() => { import("@tauri-apps/plugin-process").then(({ relaunch }) => relaunch()).catch(() => {}); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-[var(--font-sm)] font-medium bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
            >
              <RefreshCw size={13} />
              Restart Now
            </button>
          </>
        )}

        {state === "error" && (
          <p className="text-[var(--font-xs)] text-red-400">
            {error || "Something went wrong. Try again later."}
          </p>
        )}
      </div>
    </div>
  );
}
