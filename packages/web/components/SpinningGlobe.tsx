"use client";

import { motion } from "framer-motion";

// Classic CSS-3D "wireframe sphere" construction: several great-circle rings,
// each tilted to a different angle, nested in one `preserve-3d` parent that
// spins continuously on Y — no WebGL/Three.js needed for a convincing globe.
const RING_TRANSFORMS = ["rotateX(90deg)", "rotateX(60deg) rotateY(60deg)", "rotateX(60deg) rotateY(-60deg)", "rotateX(0deg)"];

export function SpinningGlobe({ size = 280 }: { size?: number }) {
  return (
    <div className="absolute" style={{ width: size, height: size, perspective: size * 2.5 }}>
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: 360 }}
        transition={{ repeat: Infinity, duration: 22, ease: "linear" }}
      >
        {RING_TRANSFORMS.map((transform, i) => (
          <div key={i} className="absolute inset-0 rounded-full border-2 border-accent/60" style={{ transform }} />
        ))}
        <div
          className="absolute rounded-full border-2 border-accent/30"
          style={{ inset: "15%", transform: "rotateX(90deg)" }}
        />
      </motion.div>
    </div>
  );
}
