import { useState, useEffect, useRef } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import { useFileListStore } from "../../stores/fileListStore";

interface SearchBarProps {
  visible: boolean;
  onClose: () => void;
}

export function SearchBar({ visible, onClose }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [matchIndices, setMatchIndices] = useState<number[]>([]);
  const [currentMatch, setCurrentMatch] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const visibleEntries = useFileListStore((s) => s.visibleEntries);
  const setSelectedIndex = useFileListStore((s) => s.setSelectedIndex);

  useEffect(() => {
    if (visible) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [visible]);

  useEffect(() => {
    if (!query.trim()) {
      setMatchIndices([]);
      setCurrentMatch(0);
      return;
    }

    const lower = query.toLowerCase();
    const indices = visibleEntries
      .map((entry, idx) => entry.name.toLowerCase().includes(lower) ? idx : -1)
      .filter((idx) => idx !== -1);

    setMatchIndices(indices);
    setCurrentMatch(0);

    if (indices.length > 0) {
      setSelectedIndex(indices[0]);
    }
  }, [query, visibleEntries]);

  const goToMatch = (direction: "next" | "prev") => {
    if (matchIndices.length === 0) return;
    let next = direction === "next" ? currentMatch + 1 : currentMatch - 1;
    if (next >= matchIndices.length) next = 0;
    if (next < 0) next = matchIndices.length - 1;
    setCurrentMatch(next);
    setSelectedIndex(matchIndices[next]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      goToMatch(e.shiftKey ? "prev" : "next");
    }
  };

  if (!visible) return null;

  return (
    <div className="h-9 bg-bg-secondary border-b border-border flex items-center px-[var(--panel-px)] gap-3">
      <Search size={13} className="text-text-muted shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in files..."
        className={clsx(
          "flex-1 bg-transparent outline-none text-[--font-base] text-text",
          "placeholder:text-text-muted/60"
        )}
      />
      {query && (
        <span className="text-[--font-xs] text-text-muted tabular-nums shrink-0">
          {matchIndices.length > 0
            ? `${currentMatch + 1} of ${matchIndices.length}`
            : "No matches"}
        </span>
      )}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => goToMatch("prev")}
          disabled={matchIndices.length === 0}
          className="p-1 rounded hover:bg-bg-hover text-text-muted disabled:opacity-30"
        >
          <ChevronUp size={13} />
        </button>
        <button
          onClick={() => goToMatch("next")}
          disabled={matchIndices.length === 0}
          className="p-1 rounded hover:bg-bg-hover text-text-muted disabled:opacity-30"
        >
          <ChevronDown size={13} />
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-bg-hover text-text-muted ml-1"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
