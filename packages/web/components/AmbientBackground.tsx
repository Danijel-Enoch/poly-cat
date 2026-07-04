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
          className="absolute rounded-full blur-3xl bg-accent/5"
          style={{ width: 440, height: 440, top: "-10%", left: "5%" }}
          animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 26, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
        <motion.div
          className="absolute rounded-full blur-3xl bg-emerald-400/4"
          style={{ width: 360, height: 360, top: "35%", right: "0%" }}
          animate={{ x: [0, -30, 20, 0], y: [0, 25, -20, 0] }}
          transition={{ duration: 22, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
        <div className="absolute" style={{ top: "6%", right: "6%" }}>
          <SpinningGlobe />
        </div>
      </motion.div>
    </div>
  );
}
