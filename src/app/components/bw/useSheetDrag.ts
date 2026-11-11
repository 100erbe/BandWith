import type React from 'react';
import { useDragControls, type PanInfo } from 'motion/react';

/**
 * Swipe down to close a bottom sheet, with an elastic pull (like the system
 * sheets). Spread `sheet` on the sheet's motion.div and `handle` on the part
 * that starts the drag: the header (grabber + title) on sheets whose body
 * scrolls, so the list keeps scrolling, or the whole sheet when nothing in it
 * scrolls. Text fields, sliders and `[data-sheet-nodrag]` never start a drag.
 */
export function useSheetDrag(onClose: () => void) {
  const controls = useDragControls();

  const sheet = {
    drag: 'y' as const,
    dragListener: false,
    dragControls: controls,
    dragConstraints: { top: 0, bottom: 0 },
    dragElastic: { top: 0.06, bottom: 0.7 },
    dragSnapToOrigin: true,
    onDragEnd: (_e: unknown, info: PanInfo) => {
      if (info.offset.y > 80 || info.velocity.y > 500) onClose();
    },
  };

  const handle = {
    onPointerDown: (e: React.PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"], [role="slider"], [data-sheet-nodrag]')) return;
      controls.start(e);
    },
    style: { touchAction: 'none' } as React.CSSProperties,
  };

  return { sheet, handle } as const;
}
