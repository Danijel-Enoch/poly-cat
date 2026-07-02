"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { SpinningGlobe } from "@/components/SpinningGlobe";

/** Lightweight CSS/framer-motion pseudo-3D backdrop — a handful of large blurred
 * gradient blobs that drift slowly and shift gently toward the cursor. Deliberately
 * not a WebGL/Three.js scene: this keeps the bundle small and matches the rest of
 * the app's flat, minimal aesthetic rather than introducing a heavier 3D look. */
export function AmbientBackground() {
  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);
  const parallaxX = useSpring(mvX, { stiffness: 40, damping: 20 });
  const parallaxY = useSpring(mvY, { stiffness: 40, damping: 20 });

  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      mvX.set(nx * 24);
      mvY.set(ny * 24);
    }
    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [mvX, mvY]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <motion.div style={{ x: parallaxX, y: parallaxY }} className="absolute inset-0">
        <motion.div
          className="absolute rounded-full blur-3xl bg-accent/25"
          style={{ width: 520, height: 520, top: "-8%", left: "5%" }}
          animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 26, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
        <motion.div
          className="absolute rounded-full blur-3xl bg-emerald-400/20"
          style={{ width: 420, height: 420, top: "35%", right: "0%" }}
          animate={{ x: [0, -30, 20, 0], y: [0, 25, -20, 0] }}
          transition={{ duration: 22, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
        <motion.div
          className="absolute rounded-full blur-3xl bg-rose-400/15"
          style={{ width: 380, height: 380, bottom: "0%", left: "20%" }}
          animate={{ x: [0, 25, -30, 0], y: [0, -20, 15, 0] }}
          transition={{ duration: 30, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
        <motion.div
          className="absolute rounded-full blur-3xl bg-accent/10"
          style={{ width: 640, height: 640, bottom: "-15%", right: "10%" }}
          animate={{ x: [0, -20, 30, 0], y: [0, 20, -25, 0] }}
          transition={{ duration: 34, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
        <div className="absolute" style={{ top: "6%", right: "6%" }}>
          <SpinningGlobe />
        </div>
      </motion.div>
    </div>
  );
}
