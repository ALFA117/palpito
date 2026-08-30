"use client";

import { SomniaMarkets, type SomniaMarkets as Exchange } from "@somnia-chain/markets-sdk";
import type { WalletClient } from "viem";
import { somniaTestnet } from "./chain";
import { ADDRESSES, COLLATERAL_DECIMALS, INDEXER_URL, ONE, WS_RPC_URL } from "./somnia";
import type { Direction } from "./indexer";
import { getMarketState, MARKET_STATUS_TRADING, type MarketState } from "./market";

/**
 * The venue's price grid, in raw collateral units.
 *
 * Binary market rows carry no tickSize or lotSize — unlike spot, the SDK cannot
 * discover them — so they come from config. Measured on testnet: the venue
 * accepts down to 1 raw unit of quantity, and prices on the 1000-unit grid.
 * A price off the grid is rejected outright with `InvalidPrice`.
 */
export const TICK = 1_000n;
export const LOT = 1n;

/** Immediate-or-cancel. See ORDER_TYPE in the SDK: 0 rest, 1 FOK, 2 IOC, 3 post-only. */
const ORDER_TYPE_IOC = 2;

/**
 * Refuse to trade a market that is not open.
 *
 * Trading is the only status that accepts orders, and the SDK skips simulation
 * on writes — so an order on a market that just locked reverts after the wallet
 * has already asked the user to sign, and after they paid the gas.
 *
 * `getMarketState` throws on an unknown or rolled-away market rather than
 * returning a hollow record, so there is nothing else to check here.
 */
function assertTradable(state: MarketState): void {
  if (state.status !== MARKET_STATUS_TRADING) throw new Error("MARKET_CLOSED");
}

let exchange: Exchange | null = null;

/**
 * One exchange per browser session — now used ONLY for writes.
 *
 * Every read moved to plain viem over HTTP (lib/rpc.ts, lib/book.ts,
 * lib/market.ts), because the SDK routes all chain access over a WebSocket: it
 * throws `NotConfiguredError` without `wsRpcUrl`, an HTTP rpcUrl on the chain is
 * not accepted, and that path hangs indefinitely in a browser while working fine
 * from Node.
 *
 * The writes still go through it, so they still carry that risk. The way out, if
 * they turn out to hang too: `trader.buildPlaceOrder` returns the unsigned call
 * rather than sending it, and passing `outcomeToken`/`yesId`/`noId`/`collateral`
 * explicitly (we already read them in `getMarketState`) keeps it from resolving
 * anything off the pool — leaving a `to`/`data`/`value` to send with the wallet
 * client directly.
 */
export function getExchange(): Exchange {
  if (!exchange) {
    exchange = new SomniaMarkets({
      indexerUrl: INDEXER_URL,
      chain: somniaTestnet,
      wsRpcUrl: WS_RPC_URL,
      addresses: { ...ADDRESSES },
    });
  }
  return exchange;
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
 * The book is quoted in UP terms throughout, so a DOWN order at probability p
 * is a YES-terms price of 1 - p. This holds for sells as well as buys: accepting
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

export interface PlaceCallResult {
  hash: string;
  /** Contracts actually filled. An IOC can fill partially or not at all. */
  filled: number;
}

/**
 * Place a call: buy the UP or DOWN side of one live window.
 *
 * IOC rather than a resting limit. An unfilled remainder would sit on the book
 * with escrow locked and no UI here to cancel it, which is a silent way to take
 * someone's money out of their wallet and leave it somewhere they cannot see.
 */
export async function placeCall({
  walletClient,
  marketId,
  direction,
  contracts,
  limitProbability,
}: PlaceCallArgs): Promise<PlaceCallResult> {
  const ex = getExchange();

  // Gate on the CHAIN, not the indexer: indexed status lags, and on this
  // deployment it does not converge at all.
  const state = await getMarketState(marketId);
  assertTradable(state);

  const trader = ex.client.createTrader({
    walletClient,
    decimals: COLLATERAL_DECIMALS,
  });

  const quantity = toLotSize(contracts);
  if (quantity <= 0n) throw new Error("SIZE_TOO_SMALL");

  const res = await trader.placeOrder({
    pool: state.pool,
    side: direction === "UP" ? "BUY_YES" : "BUY_NO",
    price: inYesTerms(direction, limitProbability),
    quantity,
    orderType: ORDER_TYPE_IOC,
    autoApprove: true,
  });

  // A reverted transaction resolves rather than throwing — the SDK signs with
  // fixed fees and skips simulation — so the receipt has to be checked by hand.
  if (res.receipt?.status === "reverted") {
    throw new Error("REVERTED");
  }

  const filled = (res.fills ?? []).reduce(
    (n, f) => n + Number(f.quantityFilled) / ONE,
    0,
  );

  return { hash: res.hash, filled };
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
 * on-chain balance — an over-sized sell reverts, and a reverted write resolves
 * rather than throwing, so it would look like it worked.
 */
export async function sellPosition({
  walletClient,
  marketId,
  direction,
  contracts,
  minProbability,
}: SellPositionArgs): Promise<PlaceCallResult> {
  const ex = getExchange();

  const state = await getMarketState(marketId);
  assertTradable(state);

  const quantity = toLotSize(contracts);
  if (quantity <= 0n) throw new Error("SIZE_TOO_SMALL");

  const trader = ex.client.createTrader({ walletClient, decimals: COLLATERAL_DECIMALS });

  const res = await trader.placeOrder({
    pool: state.pool,
    side: direction === "UP" ? "SELL_YES" : "SELL_NO",
    price: inYesTerms(direction, minProbability),
    quantity,
    orderType: ORDER_TYPE_IOC,
    autoApprove: true,
  });

  if (res.receipt?.status === "reverted") throw new Error("REVERTED");

  return {
    hash: res.hash,
    filled: (res.fills ?? []).reduce((n, f) => n + Number(f.quantityFilled) / ONE, 0),
  };
}

/**
 * Claim every settled win in one transaction.
 *
 * `redeemMany` is all-or-nothing across its entries, which is the right shape
 * here: the alternative is one wallet prompt per market, and a wallet that
 * called well for a week would face a dozen of them.
 *
 * Losing positions must be filtered out by the caller — redeeming one succeeds
 * and pays zero rather than reverting, so it would burn gas silently.
 */
export async function redeemAll(
  walletClient: WalletClient,
  entries: { marketId: string; outcomeIdx: 0 | 1; amount: bigint }[],
): Promise<{ hash: string }> {
  if (entries.length === 0) throw new Error("NOTHING_TO_CLAIM");

  const trader = getExchange().client.createTrader({
    walletClient,
    decimals: COLLATERAL_DECIMALS,
  });

  const res = await trader.redeemMany({
    entries: entries.map((e) => ({
      marketId: e.marketId as `0x${string}`,
      outcomeIdx: e.outcomeIdx,
      amount: e.amount,
    })),
  });

  if (res.receipt?.status === "reverted") throw new Error("REVERTED");
  return { hash: res.hash };
}
