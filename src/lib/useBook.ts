"use client";

import { useQuery } from "@tanstack/react-query";
import { ONE } from "./somnia";
import { getExchange } from "./trade";

export interface BestAsk {
  /** Probability a buyer of this side pays right now, 0-1. Null when nothing rests. */
  price: number;
  /** Contracts available at that level. */
  size: number;
}

export interface BookSnapshot {
  up: BestAsk | null;
  down: BestAsk | null;
}

/**
 * The best price each side can actually be bought at, read from the pool.
 *
 * The market row's `lastPrice` is the price of the last trade, which is not an
 * offer: a window can last-trade at 0.42 while the live ask sits at 0.04. Quoting
 * from it would show the wrong number and, worse, size the position against a
 * price nobody is offering. The book is one `eth_call`, so ask the book.
 *
 * `noAsks` are derived from `yesBids` (price = 1 - yesPrice) by the SDK, which is
 * what makes a DOWN buy crossable against someone else's resting UP bid.
 */
export function useBook(poolAddress: string | null | undefined) {
  return useQuery<BookSnapshot>({
    queryKey: ["binary-book", poolAddress],
    enabled: Boolean(poolAddress),
    // The venue is quoted by bots that requote often; anything staler than a few
    // seconds sizes the order against a book that has already moved.
    refetchInterval: 6_000,
    staleTime: 3_000,
    queryFn: async () => {
      const book = await getExchange().client.getBinaryOrderBook(
        poolAddress as `0x${string}`,
        { depth: 1 },
      );
      const level = (l: { price: bigint; quantity: bigint } | undefined): BestAsk | null =>
        l ? { price: Number(l.price) / ONE, size: Number(l.quantity) / ONE } : null;

      return { up: level(book.yesAsks[0]), down: level(book.noAsks[0]) };
    },
  });
}
