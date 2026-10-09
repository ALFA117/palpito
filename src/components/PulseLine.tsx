"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * The thing the product is named after: a heartbeat trace that runs like a
 * monitor under the headline. Every beat is a call — one spikes up in the UP
 * colour, the next drops in the DOWN colour. It moves by translating one long
 * repeated path, so the animation is a single transform.
 */

// One period of the trace, 220 units wide: flat, an up-spike, flat, a down-spike.
const PERIOD =
  "h34 l6 -6 l6 6 h10 l5 -30 l7 52 l6 -22 h36 l6 4 l6 -4 h30 l5 26 l7 -46 l6 20 h20 l6 -4 l6 4 h18";

export function PulseLine() {
  const reduce = useReducedMotion();
  const d = `M0 32 ${PERIOD} ${PERIOD} ${PERIOD} ${PERIOD}`;

  return (
    <div aria-hidden="true" className="pulse-line relative h-16 w-full overflow-hidden">
      <motion.svg
        viewBox="0 0 880 64"
        preserveAspectRatio="none"
        className="absolute inset-y-0 left-0 h-full w-[200%]"
        animate={reduce ? undefined : { x: ["0%", "-50%"] }}
        transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
      >
        <defs>
          <linearGradient id="pulse-ink" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--up)" />
            <stop offset="0.25" stopColor="var(--down)" />
            <stop offset="0.5" stopColor="var(--up)" />
            <stop offset="0.75" stopColor="var(--down)" />
            <stop offset="1" stopColor="var(--up)" />
          </linearGradient>
        </defs>
        <path d={d} fill="none" stroke="url(#pulse-ink)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </motion.svg>
    </div>
  );
}
