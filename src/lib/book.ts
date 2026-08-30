"use client";

import { parseAbi, type Address } from "viem";
import { ONE } from "./somnia";
import { rpc } from "./rpc";
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
 * The pool's aggregated resting book, best level first.
 *
 * `isBid` picks the side: bids come back highest-price first, asks lowest-price
 * first. BinaryPool and SpotPool share this base contract.
 */
const bookAbi = parseAbi([
  "function getBookLevels(bool isBid, uint64 numLevels) view returns ((uint256 price, uint256 quantity)[])",
]);

type Level = { price: bigint; quantity: bigint };

const toBest = (l: Level | undefined): BestAsk | null =>
  l ? { price: Number(l.price) / ONE, size: Number(l.quantity) / ONE } : null;

/** A NO price is always one minus the YES price, on the same quantity. */
const invert = (l: Level | undefined): Level | undefined =>
  l ? { price: BigInt(ONE) - l.price, quantity: l.quantity } : undefined;

/**
 * The best price each side can be bought and sold at right now.
 *
 * The book is quoted entirely in YES terms and the NO sides are derived — which
 * is exactly what makes a DOWN buy crossable against someone else's resting UP
 * bid, the mint-a-pair path. So the best NO ask comes from the best YES bid, and
 * the best NO bid from the best YES ask.
 *
 * Read from the pool rather than the market row's `lastPrice`: that field is the
 * last trade, not an offer, and we measured a window last-trading at 0.42 with a
 * live ask resting at 0.044.
 */
export async function getBook(pool: string): Promise<BookSnapshot> {
  const [yesBids, yesAsks] = await Promise.all([
    rpc.readContract({
      address: pool as Address,
      abi: bookAbi,
      functionName: "getBookLevels",
      args: [true, 1n],
    }),
    rpc.readContract({
      address: pool as Address,
      abi: bookAbi,
      functionName: "getBookLevels",
      args: [false, 1n],
    }),
  ]);

  const bestYesBid = yesBids[0] as Level | undefined;
  const bestYesAsk = yesAsks[0] as Level | undefined;

  return {
    up: toBest(bestYesAsk),
    down: toBest(invert(bestYesBid)),
    upBid: toBest(bestYesBid),
    downBid: toBest(invert(bestYesAsk)),
  };
}

/** What it costs to buy into `direction` right now. */
export const askFor = (book: BookSnapshot, direction: Direction) =>
  direction === "UP" ? book.up : book.down;

/** What selling out of `direction` pays right now. */
export const bidFor = (book: BookSnapshot, direction: Direction) =>
  direction === "UP" ? book.upBid : book.downBid;
