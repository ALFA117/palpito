"use client";

import type { Market } from "@/lib/indexer";
import { useLocale } from "./LocaleProvider";
import { CallCard } from "./CallCard";
import { ClockProvider, Countdown } from "./Clock";
import { LivePercent, WindowRing } from "./LiveNumber";
import { Sparkline } from "./Sparkline";
import { Empty } from "./Empty";
import { money, windowLabel } from "@/lib/format";
import type { ScoredCall } from "./FeedView";

export function MarketView({
  market,
  scored,
  serverNow,
}: {
  market: Market;
  scored: ScoredCall[];
  serverNow: number;
}) {
  const { t, locale } = useLocale();
  const live = market.expiry > serverNow;
  const settling = !live && !market.finalized;

  return (
    <ClockProvider now={serverNow}>
      <header className="lit-edge rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="t-display text-[clamp(1.6rem,5vw,2.3rem)]">{market.asset}</h1>
            <span className="mt-1 inline-block rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted">
              {windowLabel(market.intervalSec)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {live ? (
              <WindowRing start={market.tradingStart} expiry={market.expiry} size={44}>
                <Countdown expiry={market.expiry} className="t-figure text-[11px] text-text" />
              </WindowRing>
            ) : settling ? (
              <span className="rounded-md bg-surface-3 px-2 py-1 text-[11px] font-semibold text-muted">
                {t.settling}
              </span>
            ) : market.voided ? (
              <span className="rounded-md bg-surface-3 px-2 py-1 text-[11px] font-semibold text-muted">
                {t.void}
              </span>
            ) : (
              <span className="rounded-md bg-surface-3 px-2 py-1 text-[11px] font-semibold text-text">
                {market.winningOutcome === 0 ? t.marketClosedUp : t.marketClosedDown}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
          <span>
            {market.lastPrice === null ? (
              <span className="t-figure block text-[26px] text-faint">{t.noQuote}</span>
            ) : (
              <LivePercent value={market.lastPrice} className="t-figure block text-[26px] text-text" />
            )}
            <span className="t-label mt-0.5 block">{t.lblPrice}</span>
          </span>
          <span>
            <span className="t-figure block text-[19px] text-text">
              {money(market.volume, locale)}
            </span>
            <span className="t-label mt-0.5 block">{t.marketVolume} · tUSDC</span>
          </span>
          <span>
            <span className="t-figure block text-[19px] text-text">{market.tradeCount}</span>
            <span className="t-label mt-0.5 block">{t.marketTrades}</span>
          </span>
          <Sparkline points={market.spark} className="ml-auto h-8 w-[120px] text-faint" />
        </div>
      </header>

      <section className="mt-6">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-faint">{t.calls}</h2>
        {scored.length === 0 ? (
          <div className="mt-3">
            <Empty title={t.feedEmpty} body={t.feedEmptyWhy} />
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {scored.map(({ call, outcome }) => (
              <CallCard key={call.id} call={call} outcome={outcome} />
            ))}
          </div>
        )}
      </section>
    </ClockProvider>
  );
}
