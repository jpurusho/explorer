import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { clsx } from "clsx";
import { useToastStore } from "../stores/toastStore";

const ICONS = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
} as const;

const ACCENTS = {
  error: "text-red-400",
  success: "text-green-400",
  info: "text-accent",
} as const;

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-2.5 min-w-[260px] max-w-[380px] px-3.5 py-2.5 rounded-[var(--radius-lg)] bg-bg-secondary/95 backdrop-blur-xl border border-border/60 shadow-2xl"
            role="status"
          >
            <Icon size={15} className={clsx("shrink-0 mt-px", ACCENTS[t.kind])} />
            <span className="flex-1 text-[var(--font-sm)] text-text-secondary leading-snug break-words">
              {t.message}
            </span>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 p-0.5 rounded text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
              aria-label="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
