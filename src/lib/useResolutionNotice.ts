"use client";

import { useEffect, useRef, useState } from "react";
import type { Position } from "./positions";

export interface ResolutionNotice {
  id: string;
  asset: string;
  direction: Position["direction"];
  marketId: string;
}

/**
 * A position vanishing from the open list means one of two different things,
 * and only the window's own clock tells them apart: gone with time still on
 * it was sold (`useSell` invalidates this same query right after), gone with
 * the clock already past its expiry actually resolved. `openPositions` itself
 * only ever returns unexpired rows, so the second case never needs a refetch
 * that "sees" the resolution directly — it only needs to notice the row is
 * no longer there and check what its expiry was.
 */
export function useResolutionNotices(positions: Position[] | undefined) {
  const prev = useRef<Position[] | null>(null);
  const [notices, setNotices] = useState<ResolutionNotice[]>([]);

  useEffect(() => {
    if (positions === undefined) return;
    const before = prev.current;
    prev.current = positions;
    if (before === null) return; // first load ever: nothing to diff against

    const now = Math.floor(Date.now() / 1000);
    const stillOpen = new Set(positions.map((p) => p.id));
    const resolved = before.filter((p) => !stillOpen.has(p.id) && p.market.expiry <= now);
    if (resolved.length === 0) return;

    setNotices((n) => [
      ...n,
      ...resolved.map((p) => ({
        id: p.id,
        asset: p.market.asset,
        direction: p.direction,
        marketId: p.market.marketId,
      })),
    ]);
  }, [positions]);

  const dismiss = (id: string) => setNotices((n) => n.filter((x) => x.id !== id));

  return { notices, dismiss };
}
