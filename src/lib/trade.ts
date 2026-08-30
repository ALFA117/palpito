"use client";

import { SomniaMarkets, type SomniaMarkets as Exchange } from "@somnia-chain/markets-sdk";
import type { WalletClient } from "viem";
import { somniaTestnet } from "./chain";
import { ADDRESSES, COLLATERAL_DECIMALS, INDEXER_URL, ONE, WS_RPC_URL } from "./somnia";
import type { Direction } from "./indexer";

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

/** MarketStatus enum: 0 Listed · 1 Trading · 2 Locked · 3 Settling · 4 Resolved · 5 Voided. */
const MARKET_STATUS_TRADING = 1;

let exchange: Exchange | null = null;

/**
 * One exchange per browser session.
 *
 * It opens a WebSocket to the chain, so building a fresh one per call would
 * leak a socket on every order.
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
  // deployment it does not converge at all. Trading (1) is the only status that
  // accepts orders — a market that just locked reverts, and the SDK skips
  // simulation, so the revert lands after the wallet has already asked the user
  // to sign and after they have paid the gas.
  const onchain = await ex.client.getMarketOnchain(marketId as `0x${string}`);
  if (onchain.status !== MARKET_STATUS_TRADING) {
    throw new Error("MARKET_CLOSED");
  }

  const trader = ex.client.createTrader({
    walletClient,
    decimals: COLLATERAL_DECIMALS,
  });

  const quantity = toLotSize(contracts);
  if (quantity <= 0n) throw new Error("SIZE_TOO_SMALL");

  // The book is quoted in UP terms throughout: a DOWN buy at probability p is
  // priced at 1 - p on the same book.
  const price =
    direction === "UP" ? toTickPrice(limitProbability) : toTickPrice(1 - limitProbability);

  const res = await trader.placeOrder({
    pool: onchain.pool,
    side: direction === "UP" ? "BUY_YES" : "BUY_NO",
    price,
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
