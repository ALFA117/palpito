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
  /** Resting bids past the top, best first, in YES terms — see `estimateProceeds`. */
  yesBidDepth: BestAsk[];
  /** Resting asks past the top, best first, in YES terms. */
  yesAskDepth: BestAsk[];
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
/** Levels read past the top, for `estimateProceeds` — enough to size most positions. */
const DEPTH = 10n;

export async function getBook(pool: string): Promise<BookSnapshot> {
  const [yesBids, yesAsks] = await Promise.all([
    rpc.readContract({
      address: pool as Address,
      abi: bookAbi,
      functionName: "getBookLevels",
      args: [true, DEPTH],
    }),
    rpc.readContract({
      address: pool as Address,
      abi: bookAbi,
      functionName: "getBookLevels",
      args: [false, DEPTH],
    }),
  ]);

  const bestYesBid = yesBids[0] as Level | undefined;
  const bestYesAsk = yesAsks[0] as Level | undefined;

  return {
    up: toBest(bestYesAsk),
    down: toBest(invert(bestYesBid)),
    upBid: toBest(bestYesBid),
    downBid: toBest(invert(bestYesAsk)),
    yesBidDepth: (yesBids as Level[]).map((l) => toBest(l) as BestAsk),
    yesAskDepth: (yesAsks as Level[]).map((l) => toBest(l) as BestAsk),
  };
}

/** What it costs to buy into `direction` right now. */
export const askFor = (book: BookSnapshot, direction: Direction) =>
  direction === "UP" ? book.up : book.down;

/** What selling out of `direction` pays right now. */
export const bidFor = (book: BookSnapshot, direction: Direction) =>
  direction === "UP" ? book.upBid : book.downBid;

/**
 * What selling `contracts` of `direction` actually pays, walking the book
 * rather than pricing every contract at the top level.
 *
 * The top-of-book price is a ceiling, not a quote, once size exceeds what is
 * resting there: the rest of an IOC that exhausts the best level fills down
 * into worse prices, same as it always could — this only makes the pre-trade
 * estimate honest about it instead of implying the whole size clears at the
 * best price.
 */
export function estimateProceeds(
  book: BookSnapshot,
  direction: Direction,
  contracts: number,
): number | null {
  // A DOWN sell pays out of the YES bid side inverted, same relationship as
  // the top-of-book bid: the best NO bid is the complement of the best YES ask.
  const depth = direction === "UP" ? book.yesBidDepth : book.yesAskDepth;
  if (depth.length === 0) return null;

  let remaining = contracts;
  let proceeds = 0;
  for (const level of depth) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, level.size);
    const price = direction === "UP" ? level.price : 1 - level.price;
    proceeds += take * price;
    remaining -= take;
  }
  return proceeds;
}
