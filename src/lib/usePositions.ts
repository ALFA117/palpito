"use client";

import { useQuery } from "@tanstack/react-query";
import { openPositions, type Position } from "./positions";

/** What the connected wallet still holds in windows that have not closed. */
export function usePositions(wallet: string | undefined) {
  return useQuery<Position[]>({
    queryKey: ["positions", wallet?.toLowerCase()],
    enabled: Boolean(wallet),
    // A window closing removes a row, and a fresh call adds one, so this cannot
    // sit still — but it is a listing, not a price, so it does not need to be
    // as hot as the book.
    refetchInterval: 15_000,
    queryFn: () => openPositions(wallet as string),
  });
}
