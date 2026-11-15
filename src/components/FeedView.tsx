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
import { PulseLine } from "./PulseLine";
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
      className="fixed bottom-5 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-lg border border-text bg-gold text-on-gold shadow-[3px_3px_0_0_var(--text)] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none sm:hidden"
    >
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function Hero() {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const enter = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const, delay: 0.04 + i * 0.07 },
        };
  // The claim in ink, the promise in italic.
  const cut = t.tagline.indexOf(". ");
  const lead = cut > 0 ? t.tagline.slice(0, cut + 1) : t.tagline;
  const rest = cut > 0 ? t.tagline.slice(cut + 2) : "";
  return (
    <section className="pt-2 sm:pt-4">
      <motion.p {...enter(0)} className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
        <span className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-[12px] text-text">
          <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-up" aria-hidden="true" />
          {t.heroEyebrow}
        </span>
        {/* On phones the header only shows the mark, so the name goes here. */}
        <span className="font-display text-[15px] font-semibold text-text sm:hidden">{t.appName}</span>
      </motion.p>
      <motion.h1 {...enter(1)} className="t-display t-display-hero max-w-[16ch]">
        {lead}
        {rest && (
          <>
            {" "}
            <em className="font-medium italic text-muted">{rest}</em>
          </>
        )}
      </motion.h1>
      <motion.p {...enter(2)} className="mt-5 max-w-[58ch] text-[16px] leading-relaxed text-muted sm:text-[17px]">
        {t.whatIsThisBody}
      </motion.p>
      <motion.div {...enter(3)} className="mt-6 text-text/70">
        <PulseLine />
      </motion.div>
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
function LiveWindows({ markets, stacked = false }: { markets: Market[]; stacked?: boolean }) {
  const { t, locale } = useLocale();
  if (markets.length === 0) return null;

  const maxVolume = Math.max(...markets.map((m) => m.volume), 0);

  return (
    <section className={stacked ? "" : "mt-12"}>
      <h2 className="t-label t-rule">
        <span className="inline-flex items-center gap-2">
          <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-up" />
          {t.liveNow}
        </span>
      </h2>

      {/* In the side column the windows stack; on phones the row bleeds to the
          screen edge so it reads as scrollable rather than clipped. */}
      <div
        className={
          stacked
            ? "mt-4 flex flex-col gap-2.5"
            : "-mx-4 mt-4 flex gap-2.5 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6"
        }
      >
        {markets.slice(0, stacked ? 6 : 10).map((m) => {
          const rising = m.spark.length > 1 && m.spark[m.spark.length - 1] >= m.spark[0];
          const traded = m.spark.length > 1;
          // Volume relative to the busiest window on screen: an absolute bar
          // would be full on one market and invisible on every other.
          const share = maxVolume > 0 ? Math.min(1, m.volume / maxVolume) : 0;

          return (
            <NavLink
              key={m.marketId}
              href={`/m/${m.marketId}`}
              className={`lift block shrink-0 rounded-lg border bg-surface px-3.5 py-3 ${stacked ? "w-full" : "w-[196px]"} ${
                traded
                  ? rising
                    ? "border-up/30 tint-up breathe-up"
                    : "border-down/30 tint-down breathe-down"
                  : "border-border"
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span className="t-title text-[14px]">{m.asset}</span>
                <span className="font-mono text-[12px] text-faint">
                  {windowLabel(m.intervalSec)}
                </span>
                {/* The countdown sits beside the ring rather than inside it:
                    "23h 59m" only fit in a 30px ring at 8px, too small to read. */}
                <span className="ml-auto inline-flex items-center gap-1.5 self-center">
                  <WindowRing start={m.tradingStart} expiry={m.expiry} size={16} />
                  <Countdown expiry={m.expiry} className="t-figure text-[12px] text-muted" />
                </span>
              </div>

              <div className="mt-1.5 flex items-end justify-between gap-2">
                {/* A bare em-dash where the price goes reads as a broken cell.
                    Nothing has traded here yet, and saying that is information. */}
                {m.lastPrice === null ? (
                  <span className="flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-md border border-dashed border-border-bright px-2 font-mono text-[12px] uppercase tracking-wide text-faint">
                    {t.noQuote}
                  </span>
                ) : (
                  <LivePercent
                    value={m.lastPrice}
                    className={`t-figure text-[26px] ${rising ? "text-up" : "text-down"}`}
                  />
                )}
                {/* With no trades the dashes give way to the label, which at
                    12px needs the room to stay on one line. */}
                <Sparkline
                  points={m.spark}
                  className={`h-7 text-faint ${m.lastPrice === null ? "min-w-0 flex-1" : "w-[84px]"}`}
                />
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
                <div className="mt-1 flex items-baseline justify-between font-mono text-[12px] text-faint">
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
            className="relative inline-flex min-h-11 items-center rounded-md px-3.5 text-[13px] font-medium"
          >
            {active && !reduce && (
              <motion.span
                layoutId="asset-pill"
                className="absolute inset-0 rounded-md bg-text"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            {active && reduce && <span className="absolute inset-0 rounded-md bg-text" />}
            <span
              className={`relative z-10 ${active ? "text-bg" : "text-muted hover:text-text"}`}
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
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end lg:gap-12">
        <Hero />
        <Onboarding />
      </div>

      <div className="mt-10">
        <Ticker markets={markets} />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div className="min-w-0">
          <ClaimBanner />

          <div id="composer" className="scroll-mt-20">
            <CallComposer markets={markets} />
          </div>

          <Positions />
          <div className="lg:hidden">
            <LiveWindows markets={markets} />
          </div>

          <section className="mt-12">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <h2 className="font-display text-[24px] font-semibold tracking-[-0.015em]">{t.feedTitle}</h2>
              <AssetFilter markets={markets} asset={asset} />
            </div>

            {scored.length === 0 ? (
              <div className="mt-5">
                <Empty title={t.feedEmpty} body={t.feedEmptyWhy} tone="gold" />
              </div>
            ) : (
              <motion.div
                className="mt-5 flex flex-col gap-4"
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
                className="mt-5 min-h-11 w-full rounded-md border border-border-bright bg-surface py-2.5 text-[13px] font-medium text-text transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                {loading ? t.loadingMore : t.loadMore}
              </button>
            )}
          </section>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <LiveWindows markets={markets} stacked />
          </div>
        </aside>
      </div>
    </ClockProvider>
  );
}
