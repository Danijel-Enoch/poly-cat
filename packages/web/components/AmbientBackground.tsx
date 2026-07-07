"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/** Soft, slow-drifting red glow layered on top of the CSS gradient in
 * globals.css — pure blurred divs, no wireframe/3D shapes. Kept deliberately
 * subtle (low opacity, slow motion) so it reads as depth behind the content
 * rather than a distraction. */
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
          className="absolute rounded-full blur-3xl bg-accent/10"
          style={{ width: 560, height: 560, top: "-15%", left: "0%" }}
          animate={{ x: [0, 50, -20, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 28, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
        <motion.div
          className="absolute rounded-full blur-3xl bg-accent-dark/10"
          style={{ width: 480, height: 480, top: "40%", right: "-5%" }}
          animate={{ x: [0, -40, 20, 0], y: [0, 30, -20, 0] }}
          transition={{ duration: 24, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
        <motion.div
          className="absolute rounded-full blur-3xl bg-accent/6"
          style={{ width: 420, height: 420, bottom: "-10%", left: "30%" }}
          animate={{ x: [0, 30, -30, 0], y: [0, -20, 20, 0] }}
          transition={{ duration: 32, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
      </motion.div>
    </div>
  );
}
