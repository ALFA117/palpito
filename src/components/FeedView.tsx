"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { Call, CallOutcome, Market } from "@/lib/indexer";
import { useLocale } from "./LocaleProvider";
import { CallCard } from "./CallCard";
import { ClockProvider, Countdown } from "./Clock";
import { asPercent, money, windowLabel } from "@/lib/format";
import { CallComposer } from "./CallComposer";
import { Positions } from "./Positions";
import { ClaimBanner } from "./ClaimBanner";

export interface ScoredCall {
  call: Call;
  outcome: CallOutcome;
}

/** Stagger, capped: past a handful of cards a cascade reads as slow, not polished. */
const STAGGER = 0.04;
const MAX_STAGGERED = 8;

function Hero() {
  const { t } = useLocale();
  return (
    <section>
      <h1 className="t-display">{t.tagline}</h1>
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

  return (
    <section className="mt-10">
      <h2 className="t-label flex items-center gap-2">
        <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-gold" />
        {t.liveNow}
      </h2>

      {/* Bleeds to the screen edge so the row reads as scrollable rather than clipped. */}
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2">
        {markets.slice(0, 10).map((m) => (
          <div
            key={m.marketId}
            className="shrink-0 rounded-xl border border-border bg-surface px-3.5 py-3"
          >
            <div className="flex items-baseline gap-2">
              <span className="t-title text-[14px]">{m.asset}</span>
              <span className="font-mono text-[10px] text-faint">
                {windowLabel(m.intervalSec)}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="t-figure text-[16px] text-up">
                {m.lastPrice === null ? "—" : asPercent(m.lastPrice)}
              </span>
              <Countdown expiry={m.expiry} className="t-figure text-[12px] text-faint" />
            </div>
            {/* DreamDEX's own FAQ notes volume "is not shown in the app yet, but
                it is on-chain". It rides on the market row we already read. */}
            {m.volume > 0 && (
              <div className="mt-1 font-mono text-[10px] text-faint">
                {money(m.volume, locale)} tUSDC
              </div>
            )}
          </div>
        ))}
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
          <Link
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
          </Link>
        );
      })}
    </nav>
  );
}

export function FeedView({
  scored,
  markets,
  serverNow,
  asset,
}: {
  scored: ScoredCall[];
  markets: Market[];
  serverNow: number;
  asset: string | null;
}) {
  const { t } = useLocale();
  const reduce = useReducedMotion();

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
      <Hero />
      <ClaimBanner />

      <div className="mt-8">
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
          <p className="mt-4 rounded-2xl border border-border bg-surface p-6 text-[14px] text-muted">
            {t.feedEmpty}
          </p>
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
      </section>
    </ClockProvider>
  );
}
