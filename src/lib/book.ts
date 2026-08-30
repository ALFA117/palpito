"use client";

import { ONE } from "./somnia";
import { getExchange } from "./trade";
import type { Direction } from "./indexer";

export interface BestAsk {
  /** Probability a buyer of this side pays right now, 0-1. */
  price: number;
  /** Contracts available at that level. */
  size: number;
}

export interface BookSnapshot {
  /** What buying each side costs. */
  up: BestAsk | null;
  down: BestAsk | null;
  /** What selling each side pays. */
  upBid: BestAsk | null;
  downBid: BestAsk | null;
}

/**
 * The best price each side can actually be bought at, read from the pool.
 *
 * The market row's `lastPrice` is the price of the last trade, which is not an
 * offer: a window can last-trade at 0.42 while the live ask sits at 0.04.
 * Quoting from it would show the wrong number and, worse, size the position
 * against a price nobody is offering. The book is one `eth_call`, so ask it.
 *
 * `noAsks` are derived from `yesBids` (price = 1 - yesPrice) by the SDK, which
 * is what makes a DOWN buy crossable against someone else's resting UP bid.
 *
 * Plain function rather than a hook: the composer polls it through react-query,
 * but a feed card only needs it at the moment someone taps join — forty cards
 * each holding a subscription would be forty `eth_call`s a tick for a number
 * nobody is looking at.
 */
export async function getBook(pool: string): Promise<BookSnapshot> {
  const book = await getExchange().client.getBinaryOrderBook(pool as `0x${string}`, {
    depth: 1,
  });
  const level = (l: { price: bigint; quantity: bigint } | undefined): BestAsk | null =>
    l ? { price: Number(l.price) / ONE, size: Number(l.quantity) / ONE } : null;

  return {
    up: level(book.yesAsks[0]),
    down: level(book.noAsks[0]),
    upBid: level(book.yesBids[0]),
    downBid: level(book.noBids[0]),
  };
}

/** What it costs to buy into `direction` right now. */
export const askFor = (book: BookSnapshot, direction: Direction) =>
  direction === "UP" ? book.up : book.down;

/** What selling out of `direction` pays right now. */
export const bidFor = (book: BookSnapshot, direction: Direction) =>
  direction === "UP" ? book.upBid : book.downBid;
