"use client";

import { NavLink } from "./RouteProgress";
import { motion, useReducedMotion } from "motion/react";
import type { Call, CallOutcome, Market } from "@/lib/indexer";
import { useLocale } from "./LocaleProvider";
import { CallCard } from "./CallCard";
import { ClockProvider, Countdown } from "./Clock";
import { money, windowLabel } from "@/lib/format";
import { CallComposer } from "./CallComposer";
import { Positions } from "./Positions";
import { ClaimBanner } from "./ClaimBanner";
import { Sparkline } from "./Sparkline";
import { Ticker } from "./Ticker";
import { LivePercent, WindowRing } from "./LiveNumber";
import { Empty } from "./Empty";
import { Onboarding } from "./Onboarding";
import { useLoadMore } from "@/lib/useLoadMore";

export interface ScoredCall {
  call: Call;
  outcome: CallOutcome;
}

/** Stagger, capped: past a handful of cards a cascade reads as slow, not polished. */
const STAGGER = 0.04;
const MAX_STAGGERED = 8;

/**
 * A standing shortcut back to the composer, for the scroll depth the wall
 * actually reaches.
 *
 * `main` already reserved `pb-28` beneath the content for exactly this — a
 * mobile-only fixed control, so the last cards in the wall never sit flush
 * against the viewport edge with nothing to tap.
 */
function ComposerFab() {
  const { t } = useLocale();
  return (
    <button
      type="button"
      onClick={() => document.getElementById("composer")?.scrollIntoView({ behavior: "smooth" })}
      aria-label={t.composerTitle}
      className="glow-gold fixed bottom-5 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-on-gold shadow-lg transition-transform hover:scale-105 active:scale-95 sm:hidden"
    >
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function Hero() {
  const { t } = useLocale();
  return (
    <section>
      <h1 className="t-display t-display-grad">{t.tagline}</h1>
      <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-muted">
        {t.whatIsThisBody}
      </p>
    </section>
  );
}

/**
 * The open windows, as a ticker.
 *
 * Horizontal and monospaced on purpose: this is the one part of the page that
 * behaves like market data, and it should read like it rather than like more
 * cards.
 */
function LiveWindows({ markets }: { markets: Market[] }) {
  const { t, locale } = useLocale();
  if (markets.length === 0) return null;

  const maxVolume = Math.max(...markets.map((m) => m.volume), 0);

  return (
    <section className="mt-10">
      <h2 className="t-label flex items-center gap-2">
        <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-gold" />
        {t.liveNow}
      </h2>

      {/* Bleeds to the screen edge so the row reads as scrollable rather than clipped. */}
      <div className="-mx-4 mt-3 flex gap-2.5 overflow-x-auto px-4 pb-2">
        {markets.slice(0, 10).map((m) => {
          const rising = m.spark.length > 1 && m.spark[m.spark.length - 1] >= m.spark[0];
          const traded = m.spark.length > 1;
          // Volume relative to the busiest window on screen: an absolute bar
          // would be full on one market and invisible on every other.
          const share = maxVolume > 0 ? Math.min(1, m.volume / maxVolume) : 0;

          return (
            <NavLink
              key={m.marketId}
              href={`/m/${m.marketId}`}
              className={`lift block w-[186px] shrink-0 rounded-xl border bg-surface px-3.5 py-3 ${
                traded
                  ? rising
                    ? "border-up/30 tint-up breathe-up"
                    : "border-down/30 tint-down breathe-down"
                  : "border-border"
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span className="t-title text-[14px]">{m.asset}</span>
                <span className="font-mono text-[10px] text-faint">
                  {windowLabel(m.intervalSec)}
                </span>
                <span className="ml-auto">
                  <WindowRing start={m.tradingStart} expiry={m.expiry} size={30}>
                    <Countdown expiry={m.expiry} className="t-figure text-[8px] text-muted" />
                  </WindowRing>
                </span>
              </div>

              <div className="mt-1.5 flex items-end justify-between gap-2">
                {/* A bare em-dash where the price goes reads as a broken cell.
                    Nothing has traded here yet, and saying that is information. */}
                {m.lastPrice === null ? (
                  <span className="flex h-[30px] items-center rounded-md border border-dashed border-border-bright px-2 font-mono text-[10px] uppercase tracking-wider text-faint">
                    {t.noQuote}
                  </span>
                ) : (
                  <LivePercent
                    value={m.lastPrice}
                    className={`t-figure text-[26px] ${rising ? "text-up" : "text-down"}`}
                  />
                )}
                <Sparkline points={m.spark} className="h-7 w-[84px] text-faint" />
              </div>

              {/* DreamDEX's own FAQ notes volume "is not shown in the app yet,
                  but it is on-chain". It rides on the market row we already read. */}
              <div className="mt-2.5">
                <div className="h-[3px] w-full overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={`h-full rounded-full ${rising ? "bg-up/60" : "bg-down/60"}`}
                    style={{ width: `${Math.max(share * 100, m.volume > 0 ? 6 : 0)}%` }}
                  />
                </div>
                {/* Zeroes, not dashes: this is a live venue reporting no
                    volume, which is a fact rather than a missing value. */}
                <div className="mt-1 flex items-baseline justify-between font-mono text-[9.5px] text-faint">
                  <span>{money(m.volume, locale)} t</span>
                  <span>{m.tradeCount}×</span>
                </div>
              </div>
            </NavLink>
          );
        })}
      </div>
    </section>
  );
}

function AssetFilter({ markets, asset }: { markets: Market[]; asset: string | null }) {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const assets = [...new Set(markets.map((m) => m.asset))].sort();
  if (assets.length < 2) return null;

  const options: { key: string; label: string; href: string }[] = [
    { key: "all", label: t.filterAll, href: "/" },
    ...assets.map((a) => ({ key: a, label: a, href: `/?a=${a}` })),
  ];

  return (
    <nav className="flex gap-0.5">
      {options.map((o) => {
        const active = o.key === (asset ?? "all");
        return (
          <NavLink
            key={o.key}
            href={o.href}
            aria-current={active ? "page" : undefined}
            className="relative rounded-lg px-2.5 py-1 text-[11px] font-medium"
          >
            {active && !reduce && (
              <motion.span
                layoutId="asset-pill"
                className="absolute inset-0 rounded-lg bg-surface-3"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            {active && reduce && <span className="absolute inset-0 rounded-lg bg-surface-3" />}
            <span
              className={`relative z-10 ${active ? "text-text" : "text-faint hover:text-muted"}`}
            >
              {o.label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function FeedView({
  scored: initialScored,
  hasMore: initialHasMore,
  markets,
  serverNow,
  asset,
}: {
  scored: ScoredCall[];
  hasMore: boolean;
  markets: Market[];
  serverNow: number;
  asset: string | null;
}) {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const { scored, hasMore, loading, loadMore } = useLoadMore(initialScored, asset, initialHasMore);

  const container = { hidden: {}, show: { transition: { staggerChildren: STAGGER } } };
  const item = {
    hidden: { opacity: 0, y: 14 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 280, damping: 26 },
    },
  };

  return (
    <ClockProvider now={serverNow}>
      <ComposerFab />
      <Hero />
      <Onboarding />

      <div className="mt-7">
        <Ticker markets={markets} />
      </div>

      <ClaimBanner />

      <div id="composer" className="mt-8 scroll-mt-20">
        <CallComposer markets={markets} />
      </div>

      <Positions />
      <LiveWindows markets={markets} />

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="t-label">{t.feedTitle}</h2>
          <AssetFilter markets={markets} asset={asset} />
        </div>

        {scored.length === 0 ? (
          <div className="mt-4">
            <Empty title={t.feedEmpty} body={t.feedEmptyWhy} tone="gold" />
          </div>
        ) : (
          <motion.div
            className="mt-4 flex flex-col gap-3"
            variants={reduce ? undefined : container}
            initial={reduce ? undefined : "hidden"}
            animate={reduce ? undefined : "show"}
          >
            {scored.map(({ call, outcome }, i) => (
              <motion.div
                key={call.id}
                variants={reduce || i >= MAX_STAGGERED ? undefined : item}
              >
                <CallCard call={call} outcome={outcome} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {hasMore && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadMore()}
            className="mt-4 w-full rounded-xl border border-border bg-surface py-2.5 text-[12px] font-medium text-muted transition-colors hover:border-border-bright hover:text-text disabled:opacity-50"
          >
            {loading ? t.loadingMore : t.loadMore}
          </button>
        )}
      </section>
    </ClockProvider>
  );
}
