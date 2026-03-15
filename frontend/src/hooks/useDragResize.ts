import { useEffect, useRef, useState } from "react";

/**
 * Drag-to-resize hook for workspace panels.
 * Returns the current panel width and a mouse-down handler to attach
 * to the drag handle element between panels.
 */
export function useDragResize(defaultWidth = 224, min = 180, max = 320) {
  const [width, setWidth]  = useState(defaultWidth);
  const dragging           = useRef<boolean>(false);
  const startX             = useRef(0);
  const startW             = useRef(0);

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    startX.current   = e.clientX;
    startW.current   = width;
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onEnd);
  }

  function onMove(e: MouseEvent) {
    if (!dragging.current) return;
    setWidth(Math.min(max, Math.max(min, startW.current + (e.clientX - startX.current))));
  }

  function onEnd() {
    dragging.current           = false;
    document.body.style.cursor     = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup",   onEnd);
  }

  // Cleanup on unmount
  useEffect(() => () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup",   onEnd);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { width, onDragStart };
}
