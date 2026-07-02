"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";

type Ripple = { id: number; x: number; y: number; size: number };

/** Reusable click-ripple effect. Spread `onPointerDown` onto the interactive
 * element (must be `relative overflow-hidden`, or inherit rounding via
 * `rounded-[inherit]`) and render `rippleLayer` as its first child. Composes
 * with an existing `whileTap={{ scale: ... }}` — this only adds the expanding
 * circle, it doesn't replace the press-scale feedback. */
export function useClickRipple() {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const idRef = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const id = idRef.current++;
    setRipples((prev) => [...prev, { id, x, y, size }]);
  }, []);

  const removeRipple = useCallback((id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const rippleLayer = (
    <span className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none">
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          className="absolute rounded-full bg-accent/50"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
          initial={{ scale: 0, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          onAnimationComplete={() => removeRipple(r.id)}
        />
      ))}
    </span>
  );

  return { onPointerDown, rippleLayer };
}
