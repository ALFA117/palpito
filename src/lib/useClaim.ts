"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useWalletClient } from "wagmi";
import { CHAIN_ID } from "./somnia";
import { claimableWinnings, totalPayout, type Claim } from "./claims";
import { redeemAll } from "./trade";
import { useCollateralBalance } from "./useCollateral";
import { useAfterWrite } from "./useAfterWrite";

export type ClaimPhase =
  | { k: "idle" }
  | { k: "claiming" }
  | { k: "done"; hash: string; latencyMs: number }
  | { k: "error"; code: "rejected" | "generic" };

export function useClaimable(wallet: string | undefined) {
  return useQuery<Claim[]>({
    queryKey: ["claims", wallet?.toLowerCase()],
    enabled: Boolean(wallet),
    // Windows settle on their own schedule, so this grows without the user
    // doing anything.
    refetchInterval: 30_000,
    queryFn: () => claimableWinnings(wallet as string),
  });
}

export function useClaim() {
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: CHAIN_ID });
  const { refetch: refetchBalance } = useCollateralBalance(address);
  const claimable = useClaimable(address);

  const afterWrite = useAfterWrite();

  const [phase, setPhase] = useState<ClaimPhase>({ k: "idle" });

  const claims = claimable.data ?? [];
  const total = totalPayout(claims);
  const connected = isConnected && chainId === CHAIN_ID && Boolean(walletClient);

  async function run() {
    if (!walletClient || claims.length === 0) return;
    setPhase({ k: "claiming" });
    try {
      const res = await redeemAll(
        walletClient,
        claims.map((c) => ({ marketId: c.marketId, outcomeIdx: c.outcomeIdx, amount: c.raw })),
      );
      setPhase({ k: "done", hash: res.hash, latencyMs: res.latencyMs });
      void refetchBalance();
      void claimable.refetch();
      afterWrite();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPhase({
        k: "error",
        code: /user rejected|denied|UserRejected/i.test(msg) ? "rejected" : "generic",
      });
    }
  }

  return { claims, total, phase, run, connected };
}
