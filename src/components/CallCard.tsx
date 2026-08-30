"use client";

import Link from "next/link";
import type { Call, CallOutcome } from "@/lib/indexer";
import { oracleGraphUrl, explorerTxUrl } from "@/lib/somnia";
import { asPercent, handleFor, money, shortAddress, timeAgo, windowLabel } from "@/lib/format";
import { useLocale } from "./LocaleProvider";
import { Countdown, useNow } from "./Clock";

function DirectionPill({ direction }: { direction: Call["direction"] }) {
  const { t } = useLocale();
  const up = direction === "UP";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-semibold ${
        up ? "bg-up-dim text-up" : "bg-down-dim text-down"
      }`}
    >
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {up ? t.up : t.down}
    </span>
  );
}

function Verdict({ outcome }: { outcome: CallOutcome }) {
  const { t } = useLocale();
  const map: Record<CallOutcome, { label: string; cls: string }> = {
    won: { label: t.won, cls: "bg-up-dim text-up" },
    lost: { label: t.lost, cls: "bg-down-dim text-down" },
    void: { label: t.void, cls: "bg-surface-2 text-muted" },
    pending: { label: t.pending, cls: "bg-surface-2 text-gold" },
  };
  const v = map[outcome];
  return (
    <span className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${v.cls}`}>{v.label}</span>
  );
}

export function CallCard({ call, outcome }: { call: Call; outcome: CallOutcome }) {
  const { t, locale } = useLocale();
  const now = useNow();
  const m = call.market;
  // Liveness comes from the window's own clock. `clobStatus` still reads
  // "Trading" on markets that closed weeks ago, so trusting it would put a
  // ticking countdown on a call that settled in July.
  const live = outcome === "pending" && m.expiry > now;
  const settling = outcome === "pending" && !live;

  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <header className="flex items-center gap-2 text-[13px]">
        <Link
          href={`/u/${call.wallet}`}
          className="font-semibold text-text hover:text-gold transition-colors"
        >
          {handleFor(call.wallet)}
        </Link>
        <span className="font-mono text-[11px] text-faint">{shortAddress(call.wallet)}</span>
        <span className="ml-auto text-[11px] text-faint">{timeAgo(call.timestamp, locale, now)}</span>
      </header>

      <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-[15px] leading-snug">
        <span className="text-muted">{t.called}</span>
        <span className="font-semibold">{m.asset}</span>
        <DirectionPill direction={call.direction} />
        <span className="text-muted">
          {call.direction === "UP" ? t.upLong : t.downLong}
        </span>
        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted">
          {windowLabel(m.intervalSec)}
        </span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
        <span>
          {t.staked}{" "}
          <span className="font-mono text-text">{money(call.stake, locale)}</span> tUSDC
        </span>
        <span>
          {t.atOdds} <span className="font-mono text-text">{asPercent(call.price)}</span>
        </span>
        {live ? (
          <span className="flex items-center gap-1.5">
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-gold" />
            {t.closesIn} <Countdown expiry={m.expiry} className="font-mono text-text" />
          </span>
        ) : settling ? (
          <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[12px] font-semibold text-muted">
            {t.settling}
          </span>
        ) : (
          <Verdict outcome={outcome} />
        )}

        {/* Most fills on this venue are mint-a-pair, so this is a quiet chip
            rather than a callout — repeated ten times down the page, an
            explanation block stops being information and becomes wallpaper. */}
        {call.mintedPair && (
          <span
            title={t.madeLiquidityWhy}
            className="inline-flex cursor-help items-center gap-1 rounded border border-gold/25 px-1.5 py-0.5 text-[10px] font-medium text-gold/90"
          >
            ◇ {t.madeLiquidity}
          </span>
        )}
      </div>

      <footer className="mt-3 flex items-center gap-3 text-[11px]">
        {m.oracleQuestionId && (outcome === "won" || outcome === "lost" || outcome === "void") && (
          <a
            href={oracleGraphUrl(m.oracleQuestionId)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gold hover:underline"
          >
            {t.verify} →
          </a>
        )}
        <a
          href={explorerTxUrl(call.txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-faint hover:text-muted"
        >
          tx {call.txHash.slice(0, 8)}
        </a>
      </footer>
    </article>
  );
}
