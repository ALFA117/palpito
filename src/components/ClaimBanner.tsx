"use client";

import { explorerTxUrl } from "@/lib/somnia";
import { money, windowLabel } from "@/lib/format";
import { useClaim } from "@/lib/useClaim";
import { useLocale } from "./LocaleProvider";

/**
 * Unclaimed winnings, and one button to sweep them.
 *
 * This exists because the protocol does not do it for you: a settled market
 * pays out only when someone asks, so a wallet that calls well accumulates its
 * money across finalised markets while its balance reads near zero. Nothing in
 * the venue's own interface says so either. On a feed whose whole promise is
 * "the chain settles it for you", leaving the last step invisible would be the
 * one dishonest thing in the product.
 */
export function ClaimBanner() {
  const { t, locale } = useLocale();
  const { claims, total, phase, run, connected } = useClaim();

  if (phase.k === "done") {
    return (
      <section className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-up/40 bg-up-dim px-5 py-3.5">
        <span className="text-[14px] font-semibold text-up">{t.claimed}</span>
        <a
          href={explorerTxUrl(phase.hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] text-up/80 hover:underline"
        >
          {phase.hash.slice(0, 10)}
        </a>
      </section>
    );
  }

  if (!connected || claims.length === 0) return null;

  const voids = claims.filter((c) => c.voided).length;

  return (
    <section className="lit-edge mt-8 rounded-2xl border border-gold/40 bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="t-title text-[15px] text-gold">{t.unclaimed}</h2>
        <span className="t-figure text-[34px] text-text">{money(total, locale)}</span>
        <span className="text-[12px] text-faint">tUSDC</span>
      </div>

      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{t.unclaimedWhy}</p>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {claims.slice(0, 8).map((c) => (
          <li
            key={c.id}
            className="rounded border border-border bg-surface-2 px-2 py-1 text-[11px] text-muted"
          >
            {c.asset} {windowLabel(c.intervalSec)}{" "}
            <span className="font-mono text-text">{money(c.payout, locale)}</span>
            {c.voided && <span className="text-faint"> · {t.fromVoids}</span>}
          </li>
        ))}
        {claims.length > 8 && (
          <li className="px-2 py-1 text-[11px] text-faint">+{claims.length - 8}</li>
        )}
      </ul>

      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={phase.k === "claiming"}
          onClick={() => void run()}
          className="rounded-xl bg-gold px-5 py-3 text-[14px] font-semibold text-on-gold transition-colors hover:bg-gold/90 disabled:opacity-40"
        >
          {phase.k === "claiming" ? t.claiming : `${t.claimAll} · ${money(total, locale)}`}
        </button>
        {phase.k === "error" && (
          <span className="text-[12px] text-down">
            {phase.code === "rejected" ? t.errRejected : t.claimFailed}
          </span>
        )}
        <span className="text-[11px] text-faint">
          {claims.length - voids} {t.fromWins}
          {voids > 0 && ` · ${voids} ${t.fromVoids}`}
        </span>
      </div>
    </section>
  );
}
