import { useCallback, useEffect, useRef, useState } from 'react';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export function SplitPane({ left, right, defaultWidth = 360, minWidth = 200, maxWidth = 600 }: SplitPaneProps) {
  const [width, setWidth] = useState(defaultWidth);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) {
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.min(maxWidth, Math.max(minWidth, e.clientX - rect.left));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [minWidth, maxWidth]);

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden">
      {/* Left panel */}
      <div className="overflow-auto border-r border-border shrink-0" style={{ width }}>
        {left}
      </div>

      {/* Drag handle */}
      <div
        className="w-1 shrink-0 cursor-col-resize hover:bg-ring/30 active:bg-ring/50 transition-colors"
        onMouseDown={onMouseDown}
      />

      {/* Right panel */}
      <div className="flex-1 overflow-hidden">{right}</div>
    </div>
  );
}
