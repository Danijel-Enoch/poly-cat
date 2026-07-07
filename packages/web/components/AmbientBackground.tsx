"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";

type BubbleConfig = {
  /** Position and size as viewport percentages/px — plain CSS, so the very
   * first server and client paint match exactly (no window-size math yet). */
  top: string;
  left: string;
  size: number;
  colors: [string, string]; // [highlight-facing fill, shadow-facing fill]
  drift: { x: number[]; y: number[]; duration: number };
  /** How far this bubble gets pushed away from a nearby cursor, in px. */
  repelStrength: number;
};

const BUBBLES: BubbleConfig[] = [
  { top: "-8%", left: "4%", size: 260, colors: ["#ffe066", "#e2b600"], drift: { x: [0, 40, -15, 0], y: [0, -25, 15, 0], duration: 26 }, repelStrength: 70 },
  { top: "8%", left: "78%", size: 180, colors: ["#fff3b0", "#ffd000"], drift: { x: [0, -30, 20, 0], y: [0, 20, -20, 0], duration: 22 }, repelStrength: 60 },
  { top: "58%", left: "88%", size: 220, colors: ["#ffe066", "#c99700"], drift: { x: [0, -25, 15, 0], y: [0, 25, -15, 0], duration: 30 }, repelStrength: 65 },
  { top: "72%", left: "10%", size: 320, colors: ["#fff3b0", "#e2b600"], drift: { x: [0, 30, -25, 0], y: [0, -20, 10, 0], duration: 34 }, repelStrength: 80 },
  { top: "35%", left: "50%", size: 140, colors: ["#ffe066", "#ffd000"], drift: { x: [0, 20, -30, 0], y: [0, -30, 20, 0], duration: 20 }, repelStrength: 55 },
  { top: "18%", left: "30%", size: 100, colors: ["#fff8dc", "#e2b600"], drift: { x: [0, -18, 24, 0], y: [0, 18, -12, 0], duration: 18 }, repelStrength: 50 },
  { top: "85%", left: "55%", size: 150, colors: ["#ffe066", "#c99700"], drift: { x: [0, 22, -18, 0], y: [0, -15, 10, 0], duration: 24 }, repelStrength: 55 },
];

/** Radius (px) around the cursor within which a bubble feels the repulsion. */
const REPEL_RADIUS = 340;

function Bubble({ config, mouseX, mouseY }: { config: BubbleConfig; mouseX: MotionValue<number>; mouseY: MotionValue<number> }) {
  const rawOffsetX = useTransform([mouseX, mouseY], (latest) => {
    const [mx, my] = latest as [number, number];
    if (typeof window === "undefined") return 0;
    const bubbleX = (parseFloat(config.left) / 100) * window.innerWidth + config.size / 2;
    const bubbleY = (parseFloat(config.top) / 100) * window.innerHeight + config.size / 2;
    const dx = bubbleX - mx;
    const dy = bubbleY - my;
    const dist = Math.hypot(dx, dy);
    if (dist === 0 || dist > REPEL_RADIUS) return 0;
    const strength = (1 - dist / REPEL_RADIUS) * config.repelStrength;
    return (dx / dist) * strength;
  });
  const rawOffsetY = useTransform([mouseX, mouseY], (latest) => {
    const [mx, my] = latest as [number, number];
    if (typeof window === "undefined") return 0;
    const bubbleX = (parseFloat(config.left) / 100) * window.innerWidth + config.size / 2;
    const bubbleY = (parseFloat(config.top) / 100) * window.innerHeight + config.size / 2;
    const dx = bubbleX - mx;
    const dy = bubbleY - my;
    const dist = Math.hypot(dx, dy);
    if (dist === 0 || dist > REPEL_RADIUS) return 0;
    const strength = (1 - dist / REPEL_RADIUS) * config.repelStrength;
    return (dy / dist) * strength;
  });
  const offsetX = useSpring(rawOffsetX, { stiffness: 120, damping: 16, mass: 0.6 });
  const offsetY = useSpring(rawOffsetY, { stiffness: 120, damping: 16, mass: 0.6 });

  return (
    <motion.div className="absolute" style={{ top: config.top, left: config.left, x: offsetX, y: offsetY }}>
      <motion.div
        className="rounded-full"
        style={{
          width: config.size,
          height: config.size,
          background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.65), transparent 42%),
            radial-gradient(circle at 68% 74%, rgba(0,0,0,0.3), transparent 62%),
            radial-gradient(circle at 42% 40%, ${config.colors[0]}, ${config.colors[1]} 100%)`,
          boxShadow: "0 10px 30px rgba(0,0,0,0.35), inset 0 0 24px rgba(255,255,255,0.06)",
          opacity: 0.22,
        }}
        animate={{ x: config.drift.x, y: config.drift.y }}
        transition={{ duration: config.drift.duration, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      />
    </motion.div>
  );
}

/** A field of glossy, gold-toned "bubbles" (layered radial gradients — highlight
 * + shadow + fill — for a 3D sphere look, no WebGL) drifting slowly, that also
 * lean away from the cursor when it passes nearby. Pure transforms
 * (`pointer-events: none`, fixed positioning) so it never affects layout or
 * interaction, and the mouse listener attaches only after mount so the very
 * first server/client paint match (no window-size math during SSR). */
export function AmbientBackground() {
  const mouseX = useMotionValue(-9999);
  const mouseY = useMotionValue(-9999);

  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    }
    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [mouseX, mouseY]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {BUBBLES.map((config, i) => (
        <Bubble key={i} config={config} mouseX={mouseX} mouseY={mouseY} />
      ))}
    </div>
  );
}
