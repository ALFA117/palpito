"use client";

import {
  maxUint256,
  parseAbi,
  parseEventLogs,
  zeroAddress,
  type Address,
  type Hex,
  type TransactionReceipt,
  type WalletClient,
} from "viem";
import { ONE } from "./somnia";
import { rpc } from "./rpc";
import type { MarketState } from "./market";

/**
 * Every write, encoded here and sent with the caller's wallet.
 *
 * Not through the SDK's trader. Its client routes all chain access over a
 * WebSocket — it refuses to start without `wsRpcUrl`, an HTTP rpcUrl is not
 * accepted, and that path hangs indefinitely in a browser while working from
 * Node. Reads moved off it first; this is the other half, so nothing on the
 * money path depends on a transport we cannot make work in the browser.
 *
 * ABIs and escrow arithmetic are transcribed from the SDK rather than guessed,
 * and the encodings are checked against it in the repo's write-path test.
 */

const poolAbi = parseAbi([
  // The YES/NO kind is an explicit enum here: the generic `placeOrder` reverts
  // `UseBinaryPlacement` on a binary pool. `builderFeeBpsTimes1k` must stay
  // uint96 and the function payable — both are selector-critical.
  "function placeBinaryOrder(uint8 kind, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k, uint64 userData) payable returns (bool success, uint128 id)",
]);

const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const erc6909Abi = parseAbi([
  "function isOperator(address owner, address spender) view returns (bool)",
  "function setOperator(address spender, bool approved) returns (bool)",
]);

const moduleAbi = parseAbi([
  "function redeemMany(uint32 operatorId, bytes32 venueId, bytes32[] marketIds, uint8[] outcomeIdxs, uint256[] amounts)",
]);

/** The pool's fill event, transcribed from the SDK's ABI. */
const orderFilledAbi = parseAbi([
  "event OrderFilled(uint128 indexed takerOrderId, uint128 indexed makerOrderId, uint256 quantityFilled, uint256 takerRemainingQuantity, uint256 makerRemainingQuantity, uint256 fillPrice)",
]);

/** OrderKind on the pool. Order matters — these are enum positions. */
export const ORDER_KIND = { BUY_YES: 0, SELL_YES: 1, BUY_NO: 2, SELL_NO: 3 } as const;
export type BinarySide = keyof typeof ORDER_KIND;

/** OrderType: 0 rest · 1 fill-or-kill · 2 immediate-or-cancel · 3 post-only. */
export const ORDER_TYPE_IOC = 2;

const ZERO_BYTES32 = `0x${"0".repeat(64)}` as Hex;

/**
 * What the pool will pull, and from where.
 *
 * A buy escrows collateral — ceil-rounded, because the pool rounds up and an
 * allowance one wei short reverts. A sell escrows the outcome tokens themselves,
 * which the pool moves under a one-time operator grant rather than an allowance.
 */
function escrowFor(side: BinarySide, price: bigint, quantity: bigint, state: MarketState) {
  const one = BigInt(ONE);
  switch (side) {
    case "BUY_YES":
      return { kind: "erc20" as const, token: state.collateral, amount: (quantity * price + one - 1n) / one };
    case "BUY_NO":
      return { kind: "erc20" as const, token: state.collateral, amount: (quantity * (one - price) + one - 1n) / one };
    case "SELL_YES":
      return { kind: "erc6909" as const, token: state.outcomeToken, id: state.yesId, amount: quantity };
    case "SELL_NO":
      return { kind: "erc6909" as const, token: state.outcomeToken, id: state.noId, amount: quantity };
  }
}

async function account(wallet: WalletClient): Promise<Address> {
  if (wallet.account) return wallet.account.address;
  const [addr] = await wallet.getAddresses();
  if (!addr) throw new Error("NO_ACCOUNT");
  return addr;
}

/** Approve `spender` for as much collateral as it will ever pull, once. */
async function ensureAllowance(
  wallet: WalletClient,
  owner: Address,
  token: Address,
  spender: Address,
  amount: bigint,
): Promise<void> {
  if (amount === 0n) return;
  const allowance = await rpc.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  });
  if (allowance >= amount) return;

  const hash = await wallet.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, maxUint256],
    account: owner,
    chain: null,
  });
  const receipt = await rpc.waitForTransactionReceipt({ hash });
  // A reverted approve was previously indistinguishable from a reverted order:
  // both surfaced as the pool's own generic "REVERTED" once the (unapproved)
  // order tx failed a step later. Catching it here, at the source, is what lets
  // the caller tell someone "the approval failed" instead of "something failed".
  if (receipt.status === "reverted") throw new Error("APPROVAL_FAILED");
}

/**
 * Make `spender` an operator on the outcome-token singleton.
 *
 * One boolean covers every id on the singleton, so this is a one-time grant per
 * spender — not per market and not per side.
 */
async function ensureOperator(
  wallet: WalletClient,
  owner: Address,
  outcomeToken: Address,
  spender: Address,
): Promise<void> {
  const already = await rpc.readContract({
    address: outcomeToken,
    abi: erc6909Abi,
    functionName: "isOperator",
    args: [owner, spender],
  });
  if (already) return;

  const hash = await wallet.writeContract({
    address: outcomeToken,
    abi: erc6909Abi,
    functionName: "setOperator",
    args: [spender, true],
    account: owner,
    chain: null,
  });
  const receipt = await rpc.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") throw new Error("APPROVAL_FAILED");
}

export interface PlacedOrder {
  hash: Hex;
  /** Contracts filled, from the pool's own fill logs. */
  filled: number;
}

/**
 * Place one binary order and wait for it to land.
 *
 * The receipt is checked rather than assumed: this venue's writes are sent with
 * fixed fees and no simulation, so a revert arrives as a mined transaction with
 * `status: "reverted"` rather than as a thrown error.
 */
export async function placeBinaryOrder(args: {
  wallet: WalletClient;
  state: MarketState;
  side: BinarySide;
  /** YES-terms price, raw collateral units. */
  price: bigint;
  quantity: bigint;
  orderType?: number;
}): Promise<PlacedOrder> {
  const { wallet, state, side, price, quantity } = args;
  if (price <= 0n || quantity <= 0n) throw new Error("SIZE_TOO_SMALL");

  const owner = await account(wallet);
  const escrow = escrowFor(side, price, quantity, state);

  if (escrow.kind === "erc20") {
    await ensureAllowance(wallet, owner, escrow.token, state.pool, escrow.amount);
  } else {
    await ensureOperator(wallet, owner, escrow.token, state.pool);
  }

  // Every order carries an expiry, capped at the market's own. The pool rejects
  // `OrderExpiryBeyondMarket` otherwise, so the book stays drainable once the
  // window locks. Verified on-chain: the module's expiry in seconds times 1e9 is
  // exactly the pool's `marketExpiryNs`.
  const expireTimestampNs = state.expiry * 1_000_000_000n;

  const hash = await wallet.writeContract({
    address: state.pool,
    abi: poolAbi,
    functionName: "placeBinaryOrder",
    args: [
      ORDER_KIND[side],
      price,
      quantity,
      expireTimestampNs,
      args.orderType ?? ORDER_TYPE_IOC,
      0, // selfMatchingOption
      zeroAddress, // no builder
      0n, // no builder fee
      0n, // userData
    ],
    account: owner,
    chain: null,
  });

  const receipt = await rpc.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") throw new Error("REVERTED");

  return { hash, filled: filledFrom(receipt.logs, state.pool) };
}

/**
 * How much of the order actually filled, decoded from the pool's own events.
 *
 * An IOC fills fully, partially, or not at all, and the difference is the first
 * thing the person who just signed wants to know. `parseEventLogs` matches by
 * signature and ignores everything else in the receipt, so an unrelated log in
 * the same transaction cannot inflate the total.
 */
function filledFrom(logs: TransactionReceipt["logs"], pool: Address): number {
  const fills = parseEventLogs({ abi: orderFilledAbi, logs: [...logs] }).filter(
    (l) => l.address.toLowerCase() === pool.toLowerCase(),
  );
  const total = fills.reduce((n, f) => n + f.args.quantityFilled, 0n);
  return Number(total) / ONE;
}

/**
 * Claim several settled markets in one transaction.
 *
 * The module pulls the winning tokens, so it needs the same one-time operator
 * grant a sell does — on the singleton, covering every id.
 */
export async function redeemMany(args: {
  wallet: WalletClient;
  module: Address;
  outcomeToken: Address;
  entries: { marketId: Hex; outcomeIdx: 0 | 1; amount: bigint }[];
}): Promise<{ hash: Hex }> {
  const { wallet, module, outcomeToken, entries } = args;
  if (entries.length === 0) throw new Error("NOTHING_TO_CLAIM");

  const owner = await account(wallet);
  await ensureOperator(wallet, owner, outcomeToken, module);

  const hash = await wallet.writeContract({
    address: module,
    abi: moduleAbi,
    functionName: "redeemMany",
    args: [
      0, // operatorId: no routing attribution
      ZERO_BYTES32, // venueId: same
      entries.map((e) => e.marketId),
      entries.map((e) => e.outcomeIdx),
      entries.map((e) => e.amount),
    ],
    account: owner,
    chain: null,
  });

  const receipt = await rpc.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") throw new Error("REVERTED");

  return { hash };
}
