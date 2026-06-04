import { useCallback, useRef } from "react";

interface ResizeHandleProps {
  onResize: (delta: number) => void;
  direction: "left" | "right";
}

export function ResizeHandle({ onResize, direction }: ResizeHandleProps) {
  const startX = useRef(0);
  const dragging = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startX.current = e.clientX;
      dragging.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = ev.clientX - startX.current;
        startX.current = ev.clientX;
        onResize(direction === "left" ? delta : -delta);
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [onResize, direction]
  );

  return (
    <div
      onMouseDown={onMouseDown}
      className="w-[5px] cursor-col-resize shrink-0 relative z-10"
    >
      <div className="absolute inset-y-0 inset-x-0 hover:bg-accent/20 active:bg-accent/40 transition-colors" />
    </div>
  );
}
