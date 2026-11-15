"use client";

import { NavLink } from "./RouteProgress";
import { useEffect, useState } from "react";
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
 * actually reaches. Phones only, and only once the composer has scrolled out
 * of view above: a button pointing at something already on screen is just
 * covering content.
 */
function ComposerFab() {
  const { t } = useLocale();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const target = document.getElementById("composer");
    if (!target || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const above = entry.boundingClientRect.bottom < 0;
        setShow(!entry.isIntersecting && above);
      },
      { threshold: 0 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  return (
    <button
      type="button"
      onClick={() => document.getElementById("composer")?.scrollIntoView({ behavior: "smooth" })}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      className={`fixed bottom-5 right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-text pl-4 pr-5 text-[14px] font-semibold text-bg shadow-[0_2px_8px_rgba(15,17,21,0.18)] transition-[opacity,transform] duration-200 sm:hidden ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {t.composerTitle}
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
  // The claim in ink, the promise in a quieter tone. Upright, no italics.
  const cut = t.tagline.indexOf(". ");
  const lead = cut > 0 ? t.tagline.slice(0, cut + 1) : t.tagline;
  const rest = cut > 0 ? t.tagline.slice(cut + 2) : "";
  return (
    <section className="pt-2 sm:pt-4">
      <motion.p {...enter(0)} className="mb-5">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[12px] text-muted">
          <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-up" aria-hidden="true" />
          {t.heroEyebrow}
        </span>
      </motion.p>
      <motion.h1 {...enter(1)} className="t-display t-display-hero max-w-[18ch]">
        {lead}
        {rest && (
          <>
            {" "}
            <span className="text-faint">{rest}</span>
          </>
        )}
      </motion.h1>
      <motion.p {...enter(2)} className="mt-5 max-w-[58ch] text-[16px] leading-relaxed text-muted sm:text-[17px]">
        {t.whatIsThisBody}
      </motion.p>
      <motion.div {...enter(3)} className="mt-6 text-text/60">
        <PulseLine />
      </motion.div>
    </section>
  );
}

/** A window with trades: price, direction and the shape of the session. */
function TradedWindow({ m, share }: { m: Market; share: number }) {
  const { locale } = useLocale();
  const rising = m.spark.length > 1 && m.spark[m.spark.length - 1] >= m.spark[0];
  return (
    <NavLink href={`/m/${m.marketId}`} className="block px-4 py-3.5 transition-colors hover:bg-surface-2">
      <div className="flex items-baseline gap-2">
        <span className="t-title text-[14px]">{m.asset}</span>
        <span className="font-mono text-[12px] text-faint">{windowLabel(m.intervalSec)}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 self-center">
          <WindowRing start={m.tradingStart} expiry={m.expiry} size={14} />
          <Countdown expiry={m.expiry} className="t-figure text-[12px] text-muted" />
        </span>
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-3">
        <LivePercent
          value={m.lastPrice ?? 0}
          className={`t-figure text-[24px] leading-none ${rising ? "text-up" : "text-down"}`}
        />
        <Sparkline points={m.spark} className="h-7 w-[96px] text-faint" />
      </div>
      {/* Volume relative to the busiest window on screen. */}
      <div className="mt-2.5 flex items-center gap-3">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-3">
          <div
            className={`h-full rounded-full ${rising ? "bg-up/60" : "bg-down/60"}`}
            style={{ width: `${Math.max(share * 100, m.volume > 0 ? 6 : 0)}%` }}
          />
        </div>
        <span className="shrink-0 font-mono text-[12px] text-faint">
          {money(m.volume, locale)} t · {m.tradeCount}×
        </span>
      </div>
    </NavLink>
  );
}

/** A window nobody has traded yet: one quiet row, not a card full of zeroes. */
function QuietWindow({ m }: { m: Market }) {
  return (
    <NavLink
      href={`/m/${m.marketId}`}
      className="flex min-h-11 items-center gap-2 px-4 py-2 transition-colors hover:bg-surface-2"
    >
      <span className="t-title w-10 text-[14px]">{m.asset}</span>
      <span className="font-mono text-[12px] text-faint">{windowLabel(m.intervalSec)}</span>
      <span className="ml-auto inline-flex items-center gap-1.5">
        <WindowRing start={m.tradingStart} expiry={m.expiry} size={14} />
        <Countdown expiry={m.expiry} className="t-figure text-[12px] text-muted" />
      </span>
    </NavLink>
  );
}

/**
 * The open windows as one instrument panel: windows with trades first (price,
 * shape, volume), then the untouched ones as compact rows under a single
 * label. Same component in the side rail and on phones, so nothing is clipped.
 */
function LiveWindows({ markets, stacked = false }: { markets: Market[]; stacked?: boolean }) {
  const { t } = useLocale();
  if (markets.length === 0) return null;

  const shown = markets.slice(0, stacked ? 8 : 6);
  const traded = shown.filter((m) => m.lastPrice !== null);
  const quiet = shown.filter((m) => m.lastPrice === null);
  const maxVolume = Math.max(...traded.map((m) => m.volume), 0);

  return (
    <section className={stacked ? "" : "mt-12"}>
      <h2 className="t-label t-rule">
        <span className="inline-flex items-center gap-2">
          <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-up" />
          {t.liveNow}
        </span>
      </h2>

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
        {traded.length > 0 && (
          <div className="divide-y divide-border">
            {traded.map((m) => (
              <TradedWindow
                key={m.marketId}
                m={m}
                share={maxVolume > 0 ? Math.min(1, m.volume / maxVolume) : 0}
              />
            ))}
          </div>
        )}
        {quiet.length > 0 && (
          <div className={traded.length > 0 ? "border-t border-border" : ""}>
            <p className="t-label px-4 pb-1 pt-3">{t.noQuote}</p>
            <div className="divide-y divide-border">
              {quiet.map((m) => (
                <QuietWindow key={m.marketId} m={m} />
              ))}
            </div>
          </div>
        )}
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
              <h2 className="font-display text-[24px] font-semibold tracking-[-0.02em]">{t.feedTitle}</h2>
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
