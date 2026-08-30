"use client";

import { useEffect } from "react";
import { erc20Abi, parseAbi, type Address } from "viem";
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ADDRESSES, CHAIN_ID, COLLATERAL_DECIMALS, ONE } from "./somnia";

const testUsdcAbi = parseAbi(["function faucet(uint256 amount)"]);

/** The faucet's own default: 10,000 tUSDC, plenty for any number of demo calls. */
const FAUCET_AMOUNT = BigInt(10_000 * ONE);

/** The signer's tUSDC balance, in raw units and formatted for display. */
export function useCollateralBalance(address: Address | undefined) {
  const query = useReadContract({
    address: ADDRESSES.collateral as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: Boolean(address),
      // Escrow leaves the wallet on placement and comes back on cancel or
      // settlement, so a balance read is stale the moment a call is made.
      refetchInterval: 12_000,
    },
  });

  const raw = query.data;
  const formatted =
    raw === undefined
      ? null
      : (Number(raw) / ONE).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  return { raw, formatted, decimals: COLLATERAL_DECIMALS, refetch: query.refetch };
}

/**
 * Mint testnet collateral to the signer.
 *
 * The tUSDC contract exposes `faucet(uint256)` to anyone, which is the whole
 * onboarding story on this network: a first-time visitor goes from empty wallet
 * to able to make a call without leaving the page or asking anyone for tokens.
 */
export function useFaucet(onSuccess?: () => void) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (receipt.isSuccess) onSuccess?.();
  }, [receipt.isSuccess, onSuccess]);

  return {
    request: () =>
      writeContract({
        address: ADDRESSES.collateral as Address,
        abi: testUsdcAbi,
        functionName: "faucet",
        args: [FAUCET_AMOUNT],
        chainId: CHAIN_ID,
      }),
    isPending: isPending || receipt.isLoading,
    isSuccess: receipt.isSuccess,
    error: error ?? receipt.error,
    reset,
  };
}
