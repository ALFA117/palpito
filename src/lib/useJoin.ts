"use client";

import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { CHAIN_ID, ONE } from "./somnia";
import { askFor, getBook } from "./book";
import { placeCall } from "./trade";
import { useCollateralBalance } from "./useCollateral";
import { useAfterWrite } from "./useAfterWrite";
import type { Direction, Market } from "./indexer";

/** Same headroom the composer uses — enough to cross a quote that has moved. */
const SLIPPAGE = 0.05;

/**
 * The largest stake a one-tap join will copy.
 *
 * Joining is a single tap with no amount to confirm, so the amount has to be
 * one nobody regrets. Copying the original stake keeps it social — you are
 * matching what they put in — but a whale's call would otherwise become a
 * one-tap way to stake far more than the person meant to.
 */
const MAX_COPY = 25;

export type JoinPhase =
  | { k: "idle" }
  | { k: "placing" }
  | { k: "done"; hash: string; filled: number }
  | { k: "error"; code: "closed" | "rejected" | "nobook" | "funds" | "approval" | "generic" };

export interface JoinArgs {
  market: Market;
  direction: Direction;
  /** The stake being copied, in tUSDC. */
  stake: number;
}

/** What a one-tap join will actually stake, given what it is copying. */
export const copyStake = (stake: number) => Math.min(Math.max(stake, 1), MAX_COPY);

export function useJoin() {
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: CHAIN_ID });
  const { raw: balance, refetch } = useCollateralBalance(address);

  const afterWrite = useAfterWrite();

  const [phase, setPhase] = useState<JoinPhase>({ k: "idle" });

  const connected = isConnected && chainId === CHAIN_ID && Boolean(walletClient);

  async function run({ market, direction, stake }: JoinArgs) {
    if (!walletClient || !market.poolAddress) return;

    const amount = copyStake(stake);
    if (balance !== undefined && Number(balance) / ONE < amount) {
      setPhase({ k: "error", code: "funds" });
      return;
    }

    setPhase({ k: "placing" });
    try {
      // Priced at tap time, not from the card. The card shows what the original
      // caller paid, which is history; what this order crosses is the book now.
      const book = await getBook(market.poolAddress);
      const ask = askFor(book, direction);
      if (!ask || ask.size <= 0) {
        setPhase({ k: "error", code: "nobook" });
        return;
      }

      const res = await placeCall({
        walletClient,
        marketId: market.marketId,
        direction,
        contracts: amount / ask.price,
        limitProbability: Math.min(ask.price + SLIPPAGE, 0.99),
      });

      setPhase({ k: "done", hash: res.hash, filled: res.filled });
      void refetch();
      afterWrite();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPhase({
        k: "error",
        code: msg.includes("MARKET_CLOSED")
          ? "closed"
          : msg.includes("APPROVAL_FAILED")
            ? "approval"
            : /user rejected|denied|UserRejected/i.test(msg)
              ? "rejected"
              : "generic",
      });
    }
  }

  return { phase, run, connected, reset: () => setPhase({ k: "idle" }) };
}
