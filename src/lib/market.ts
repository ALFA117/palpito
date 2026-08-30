"use client";

import { parseAbi, type Address, type Hex } from "viem";
import { ADDRESSES } from "./somnia";
import { rpc } from "./rpc";

/**
 * The module's per-market record. Named outputs, straight from the deployed ABI.
 *
 * `markets` keeps its v1 shape, which is why the pool nonce lives in its own
 * view rather than in the tuple — we do not need the nonce here.
 */
const moduleAbi = parseAbi([
  "function markets(bytes32 marketId) view returns (uint256 oracleQuestionId, uint8 outcomeSlotCount, uint8 voidPolicy, address collateral, uint32 originOperatorId, bytes32 originVenueId, address oracleAdapter, address creator, address market, address pool, uint256 yesId, uint256 noId, uint64 tradingStart, uint64 expiry)",
]);

const marketAbi = parseAbi([
  "function outcomeToken() view returns (address)",
  "function status() view returns (uint8)",
]);

/** ERC-6909: outcome positions are ids on one shared singleton, not per-market ERC-20s. */
const outcomeTokenAbi = parseAbi([
  "function balanceOf(address owner, uint256 id) view returns (uint256)",
]);

/** MarketStatus: 0 Listed · 1 Trading · 2 Locked · 3 Settling · 4 Resolved · 5 Voided. */
export const MARKET_STATUS_TRADING = 1;

export interface MarketState {
  marketAddress: Address;
  pool: Address;
  outcomeToken: Address;
  collateral: Address;
  yesId: bigint;
  noId: bigint;
  status: number;
  expiry: bigint;
}

const ZERO = /^0x0{40}$/;

/**
 * Everything a write needs to know about a market, read straight from the chain.
 *
 * Replaces the SDK's `getMarketOnchain`, for two reasons found the hard way. Its
 * client routes all chain access over a WebSocket — it refuses to start without
 * `wsRpcUrl`, and an HTTP rpcUrl on the viem chain is not accepted — and that
 * path hangs indefinitely in a browser while working fine from Node. It also
 * returns a hollow object rather than throwing when a market has rolled away,
 * so `pool` and `outcomeToken` come back `undefined` and the failure surfaces
 * several calls later as `Address "undefined" is invalid` from inside viem.
 *
 * This throws instead, immediately, with the marketId in the message.
 *
 * Three `eth_call`s: the module record, then the market's own token and status.
 * `outcomeToken` is read rather than taken from the address book — it is a
 * shared singleton today, and a hardcoded one would silently point at the wrong
 * contract after a redeploy.
 */
export async function getMarketState(marketId: string): Promise<MarketState> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(marketId)) {
    throw new Error(`BAD_MARKET_ID: ${marketId}`);
  }

  const rec = await rpc.readContract({
    address: ADDRESSES.binaryModule as Address,
    abi: moduleAbi,
    functionName: "markets",
    args: [marketId as Hex],
  });

  const [collateral, marketAddress, pool, yesId, noId, expiry] = [
    rec[3],
    rec[8],
    rec[9],
    rec[10],
    rec[11],
    rec[13],
  ];

  if (ZERO.test(marketAddress)) throw new Error(`UNKNOWN_MARKET: ${marketId}`);

  const [outcomeToken, status] = await Promise.all([
    rpc.readContract({ address: marketAddress, abi: marketAbi, functionName: "outcomeToken" }),
    rpc.readContract({ address: marketAddress, abi: marketAbi, functionName: "status" }),
  ]);

  return {
    marketAddress,
    pool,
    outcomeToken,
    collateral,
    yesId,
    noId,
    status: Number(status),
    expiry,
  };
}

/** How many contracts of one outcome an account holds, in raw units. */
export async function getOutcomeBalance(
  outcomeToken: Address,
  account: Address,
  id: bigint,
): Promise<bigint> {
  return rpc.readContract({
    address: outcomeToken,
    abi: outcomeTokenAbi,
    functionName: "balanceOf",
    args: [account, id],
  });
}
