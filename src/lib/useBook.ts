"use client";

import { useQuery } from "@tanstack/react-query";
import { getBook, type BookSnapshot } from "./book";

export type { BestAsk, BookSnapshot } from "./book";

/**
 * The live book for one pool, polled.
 *
 * Used by the composer, where a price is on screen and has to stay honest. Feed
 * cards read the book imperatively at tap time instead — see `getBook`.
 */
export function useBook(poolAddress: string | null | undefined) {
  return useQuery<BookSnapshot>({
    queryKey: ["binary-book", poolAddress],
    enabled: Boolean(poolAddress),
    // The venue is quoted by bots that requote often; anything staler than a few
    // seconds sizes the order against a book that has already moved.
    refetchInterval: 6_000,
    staleTime: 3_000,
    retry: 3,
    retryDelay: 1_000,
    queryFn: () => getBook(poolAddress as string),
  });
}
