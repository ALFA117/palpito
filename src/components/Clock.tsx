"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { countdown } from "@/lib/format";

/**
 * The server's clock, handed to the client as a seed.
 *
 * Time-dependent markup has to be identical on the server and on the first
 * client render, or React tears the tree down and rebuilds it — and in a feed of
 * countdowns that is every card at once. Both sides start from the same server
 * timestamp and only then start ticking, so the first paint is deterministic and
 * the page still moves.
 */
const ClockCtx = createContext<number | null>(null);

export function ClockProvider({ now, children }: { now: number; children: React.ReactNode }) {
  return <ClockCtx.Provider value={now}>{children}</ClockCtx.Provider>;
}

/** Current unix seconds: the server's value on first render, live after mount. */
export function useNow(): number {
  const seed = useContext(ClockCtx);
  if (seed === null) throw new Error("useNow must be used inside <ClockProvider>");

  const [now, setNow] = useState(seed);

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}

/**
 * Ticks toward a unix expiry.
 *
 * Takes the absolute expiry rather than a precomputed remainder: the page is
 * cached for a few seconds, so a server-computed "4m left" would arrive stale
 * and then sit frozen. The expiry itself does not go stale.
 */
export function Countdown({ expiry, className }: { expiry: number; className?: string }) {
  const now = useNow();
  const left = expiry - now;

  // Under half a minute the decision is now-or-never, and a countdown that reads
  // the same at 40 minutes and 4 seconds is not telling anyone that.
  const urgent = left > 0 && left <= 30;

  return (
    <span
      className={`${className ?? ""}${urgent ? " text-down font-semibold" : ""}`}
      suppressHydrationWarning
    >
      {countdown(left)}
    </span>
  );
}
