"use client";

import type { WalletClient } from "viem";
import { ADDRESSES, ONE } from "./somnia";
import { getMarketState, MARKET_STATUS_TRADING, type MarketState } from "./market";
import { placeBinaryOrder, redeemMany, type BinarySide } from "./write";
import type { Direction } from "./indexer";
import type { Address, Hex } from "viem";

/**
 * The venue's price grid, in raw collateral units.
 *
 * Binary market rows carry no tickSize or lotSize — unlike spot, they are not
 * discoverable — so they come from config. Measured on testnet: the venue
 * accepts down to 1 raw unit of quantity, and prices on the 1000-unit grid.
 * A price off the grid is rejected outright with `InvalidPrice`.
 */
export const TICK = 1_000n;
export const LOT = 1n;

/**
 * Refuse to trade a market that is not open.
 *
 * Trading is the only status that accepts orders, and writes here are sent
 * without simulation — so an order on a market that just locked reverts after
 * the wallet has already asked the user to sign, and after they paid the gas.
 */
function assertTradable(state: MarketState): void {
  if (state.status !== MARKET_STATUS_TRADING) throw new Error("MARKET_CLOSED");
}

/** Snap a probability to the venue's tick grid, as raw collateral units. */
export function toTickPrice(probability: number): bigint {
  const raw = BigInt(Math.round(probability * ONE));
  const snapped = (raw / TICK) * TICK;
  // Never quote 0 or 1: both are outside the open interval the pool accepts,
  // and a rounded-down 0.0004 would silently become a free option.
  const min = TICK;
  const max = BigInt(ONE) - TICK;
  return snapped < min ? min : snapped > max ? max : snapped;
}

/**
 * A side's probability expressed in the book's YES terms.
 *
 * The book is quoted in UP terms throughout, so a DOWN order at probability p is
 * a YES-terms price of 1 - p. This holds for sells as well as buys: accepting
 * less for DOWN means accepting a HIGHER yes price, which the complement gives
 * for free.
 */
const inYesTerms = (direction: Direction, probability: number) =>
  toTickPrice(direction === "UP" ? probability : 1 - probability);

/** Snap a contract count to the lot grid, as raw units. */
export function toLotSize(contracts: number): bigint {
  const raw = BigInt(Math.floor(contracts * ONE));
  return (raw / LOT) * LOT;
}

const sideFor = (direction: Direction, buying: boolean): BinarySide =>
  buying
    ? direction === "UP" ? "BUY_YES" : "BUY_NO"
    : direction === "UP" ? "SELL_YES" : "SELL_NO";

export interface PlaceCallResult {
  hash: string;
  /** Contracts actually filled. An IOC can fill partially or not at all. */
  filled: number;
}

export interface PlaceCallArgs {
  walletClient: WalletClient;
  marketId: string;
  direction: Direction;
  /** Contracts to buy. Cost is roughly contracts × price. */
  contracts: number;
  /**
   * Highest probability the caller is willing to pay, 0-1. Crossing the book at
   * a slightly worse price than quoted is normal; this bounds how much worse.
   */
  limitProbability: number;
}

/**
 * Place a call: buy the UP or DOWN side of one live window.
 *
 * Immediate-or-cancel rather than a resting limit. An unfilled remainder would
 * sit on the book with escrow locked and no UI here to cancel it, which is a
 * silent way to take someone's money out of their wallet and leave it somewhere
 * they cannot see.
 */
export async function placeCall({
  walletClient,
  marketId,
  direction,
  contracts,
  limitProbability,
}: PlaceCallArgs): Promise<PlaceCallResult> {
  // Gate on the CHAIN, not the indexer: indexed status lags, and on this
  // deployment it does not converge at all.
  const state = await getMarketState(marketId);
  assertTradable(state);

  const quantity = toLotSize(contracts);
  if (quantity <= 0n) throw new Error("SIZE_TOO_SMALL");

  return placeBinaryOrder({
    wallet: walletClient,
    state,
    side: sideFor(direction, true),
    price: inYesTerms(direction, limitProbability),
    quantity,
  });
}

export interface SellPositionArgs {
  walletClient: WalletClient;
  marketId: string;
  /** Which side is held. */
  direction: Direction;
  /** Contracts to sell. */
  contracts: number;
  /** Lowest probability the seller will accept, 0-1. */
  minProbability: number;
}

/**
 * Sell out of a position before its window closes.
 *
 * The mirror of `placeCall`, with one asymmetry that matters: a sell escrows the
 * outcome tokens themselves rather than collateral, so you can only sell what
 * you actually hold. The caller is responsible for not asking for more than the
 * on-chain balance — an over-sized sell reverts.
 */
export async function sellPosition({
  walletClient,
  marketId,
  direction,
  contracts,
  minProbability,
}: SellPositionArgs): Promise<PlaceCallResult> {
  const state = await getMarketState(marketId);
  assertTradable(state);

  const quantity = toLotSize(contracts);
  if (quantity <= 0n) throw new Error("SIZE_TOO_SMALL");

  return placeBinaryOrder({
    wallet: walletClient,
    state,
    side: sideFor(direction, false),
    price: inYesTerms(direction, minProbability),
    quantity,
  });
}

/**
 * Claim every settled win in one transaction.
 *
 * All-or-nothing across its entries, which is the right shape here: the
 * alternative is one wallet prompt per market, and a wallet that called well for
 * a week would face a dozen of them.
 *
 * Losing positions must be filtered out by the caller — redeeming one succeeds
 * and pays zero rather than reverting, so it would burn gas silently.
 */
export async function redeemAll(
  walletClient: WalletClient,
  entries: { marketId: string; outcomeIdx: 0 | 1; amount: bigint }[],
): Promise<{ hash: string }> {
  if (entries.length === 0) throw new Error("NOTHING_TO_CLAIM");

  // The outcome-token singleton is read off one of the markets being claimed
  // rather than taken from the address book. It is shared across every market,
  // so any one of them answers — and a hardcoded address would send the
  // operator grant to the wrong contract after a redeploy, silently.
  const { outcomeToken } = await getMarketState(entries[0].marketId);

  return redeemMany({
    wallet: walletClient,
    module: ADDRESSES.binaryModule as Address,
    outcomeToken,
    entries: entries.map((e) => ({
      marketId: e.marketId as Hex,
      outcomeIdx: e.outcomeIdx,
      amount: e.amount,
    })),
  });
}
