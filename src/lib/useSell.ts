"use client";

import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { CHAIN_ID, ONE } from "./somnia";
import { bidFor, getBook } from "./book";
import { sellPosition } from "./trade";
import { getMarketState, getOutcomeBalance, MARKET_STATUS_TRADING } from "./market";
import type { Position } from "./positions";
import { useAfterWrite } from "./useAfterWrite";

/** Headroom below the resting bid, so a book that moved still crosses. */
const SLIPPAGE = 0.05;

export type SellPhase =
  | { k: "idle" }
  | { k: "selling" }
  | { k: "done"; hash: string; filled: number }
  | { k: "error"; code: "closed" | "rejected" | "nobid" | "empty" | "approval" | "generic" };

export function useSell() {
  const { isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: CHAIN_ID });
  const afterWrite = useAfterWrite();
  const [phase, setPhase] = useState<SellPhase>({ k: "idle" });

  const connected = isConnected && chainId === CHAIN_ID && Boolean(walletClient);

  async function run(position: Position) {
    if (!walletClient || !position.market.poolAddress) return;

    setPhase({ k: "selling" });
    try {
      const state = await getMarketState(position.market.marketId);
      if (state.status !== MARKET_STATUS_TRADING) {
        setPhase({ k: "error", code: "closed" });
        return;
      }

      // Size from the CHAIN, not from the listing. The indexed balance is
      // display-grade by the SDK's own description, and a sell escrows the
      // outcome tokens themselves — asking for one contract more than is held
      // reverts, and a reverted write resolves rather than throwing, so it would
      // look like it worked.
      const held = await getOutcomeBalance(
        state.outcomeToken,
        walletClient.account.address,
        position.direction === "UP" ? state.yesId : state.noId,
      );
      const contracts = Number(held) / ONE;
      if (contracts <= 0) {
        setPhase({ k: "error", code: "empty" });
        return;
      }

      const bid = bidFor(await getBook(state.pool), position.direction);
      if (!bid || bid.size <= 0) {
        setPhase({ k: "error", code: "nobid" });
        return;
      }

      const res = await sellPosition({
        walletClient,
        marketId: position.market.marketId,
        direction: position.direction,
        contracts,
        minProbability: Math.max(bid.price - SLIPPAGE, 0.01),
      });

      setPhase({ k: "done", hash: res.hash, filled: res.filled });
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
