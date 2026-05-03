import { useCallback, useRef } from "react";

const DEFAULT = { threshold: 48, maxAngle: 35 };

/**
 * Horizontal: onLeft (next), onRight (prev). Vertical: onUp/onDown for scroll hints.
 */
export function useSwipeNavigation({ onLeft, onRight, onUp, onDown, enabled = true } = {}, opts = DEFAULT) {
  const start = useRef(null);

  const onTouchStart = useCallback(
    (e) => {
      if (!enabled) return;
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    },
    [enabled]
  );

  const onTouchEnd = useCallback(
    (e) => {
      if (!enabled || !start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      const ratio = adx / (ady + 1);
      if (adx > opts.threshold && ratio > 1.2) {
        if (dx < 0) onLeft?.();
        else onRight?.();
      } else if (ady > opts.threshold && ratio < 0.85) {
        if (dy < 0) onUp?.();
        else onDown?.();
      }
      start.current = null;
    },
    [enabled, onDown, onLeft, onRight, onUp, opts.threshold]
  );

  return { onTouchStart, onTouchEnd };
}
