"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { CHAIN_ID } from "@/lib/somnia";
import { shortAddress } from "@/lib/format";
import { useLocale } from "./LocaleProvider";
import { useCollateralBalance } from "@/lib/useCollateral";

const pill =
  "whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-60";

export function ConnectButton() {
  const { t, locale } = useLocale();
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { formatted } = useCollateralBalance(address, locale);

  const injectedConnector = connectors[0];

  if (!isConnected) {
    // `injected()` is always present in the config, but the provider it wraps
    // only exists if the visitor actually has an extension — so the absence of
    // a wallet has to read as guidance, not as a dead button.
    const hasWallet = typeof window !== "undefined" && "ethereum" in window;

    if (!hasWallet) {
      return (
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          title={t.noWalletHelp}
          className={`${pill} border border-border bg-surface text-muted hover:text-text`}
        >
          {t.noWallet}
        </a>
      );
    }

    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => connect({ connector: injectedConnector })}
        className={`${pill} bg-gold text-[#191014] hover:bg-gold/90`}
      >
        {isPending ? t.connecting : t.connect}
      </button>
    );
  }

  if (chainId !== CHAIN_ID) {
    return (
      <button
        type="button"
        disabled={switching}
        onClick={() => switchChain({ chainId: CHAIN_ID })}
        title={t.wrongNetwork}
        className={`${pill} bg-down text-[#2a0d14] hover:bg-down/90`}
      >
        {t.switchNetwork}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/u/${address!.toLowerCase()}`}
        title={t.myRecordShort}
        className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] transition-colors hover:border-gold/40"
      >
        <span className="font-mono text-text">{formatted ?? "—"}</span>
        <span className="hidden text-faint sm:inline">tUSDC</span>
        <span className="hidden font-mono text-faint md:inline">{shortAddress(address!)}</span>
      </Link>
      <button
        type="button"
        onClick={() => disconnect()}
        aria-label={t.disconnect}
        title={t.disconnect}
        className="rounded-full border border-border bg-surface px-2 py-1.5 text-[12px] text-faint transition-colors hover:text-text"
      >
        ×
      </button>
    </div>
  );
}
