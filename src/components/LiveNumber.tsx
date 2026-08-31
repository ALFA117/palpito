"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useNow } from "./Clock";

/**
 * A percentage that reacts when it changes.
 *
 * The value rolls toward its new figure and flashes the colour of the move for
 * a beat. Both are tied to the number actually changing, so motion here always
 * means "the market moved" and never just "the page is animated" — which is the
 * difference between a live instrument and a screensaver.
 */
export function LivePercent({
  value,
  className = "",
}: {
  value: number | null;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;

    // Everything below runs from a frame callback rather than the effect body.
    // A synchronous setState here would cascade a second render on every tick of
    // a number that already re-renders once a second.
    let raf = 0;
    let clearFlash: ReturnType<typeof setTimeout> | undefined;

    if (value === null || from === null || reduce) {
      raf = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(raf);
    }

    // Roll rather than jump: a price that snaps is indistinguishable from a
    // re-render, and the point is that someone notices it moved.
    const start = performance.now();
    const DURATION = 450;
    const step = (t: number) => {
      // Clamped at BOTH ends. A frame timestamp that lands before `start` gives a
      // negative k, and the easing curve turns that into a wild multiplier — a
      // price briefly rendered as -77604%. Rare in a normal browser, immediate
      // under a fast-forwarded clock, and wrong either way.
      const k = Math.max(0, Math.min(1, (t - start) / DURATION));
      const eased = 1 - Math.pow(1 - k, 3); // ease-out-cubic
      setShown(from + (value - from) * eased);
      if (k < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame((t) => {
      setFlash(value > from ? "up" : "down");
      clearFlash = setTimeout(() => setFlash(null), 800);
      step(t);
    });

    return () => {
      cancelAnimationFrame(raf);
      if (clearFlash) clearTimeout(clearFlash);
    };
  }, [value, reduce]);

  if (shown === null) return <span className={className}>—</span>;

  return (
    <span
      className={`${className} ${flash === "up" ? "flash-up" : flash === "down" ? "flash-down" : ""}`}
      suppressHydrationWarning
    >
      {Math.round(shown * 100)}%
    </span>
  );
}

/**
 * How much of a window is already gone, as a ring around whatever it wraps.
 *
 * This is the one piece of ambient motion on the page that is pure information:
 * it sweeps because time is passing, at exactly the rate time is passing.
 */
export function WindowRing({
  start,
  expiry,
  size = 34,
  children,
}: {
  start: number;
  expiry: number;
  size?: number;
  children?: React.ReactNode;
}) {
  const now = useNow();

  const total = Math.max(1, expiry - start);
  const elapsed = Math.min(total, Math.max(0, now - start));
  const left = 1 - elapsed / total;

  const r = size / 2 - 2;
  const circumference = 2 * Math.PI * r;
  const urgent = expiry - now <= 30 && expiry > now;

  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="2" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={urgent ? "var(--down)" : "var(--gold)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - left)}
          className={urgent ? "urgent" : ""}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </span>
  );
}
