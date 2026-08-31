"use client";

import { useReducedMotion } from "motion/react";
import type { Market } from "@/lib/indexer";
import { asPercent, windowLabel } from "@/lib/format";
import { useLocale } from "./LocaleProvider";

/**
 * The venue, running along the top of the page.
 *
 * Purely a read — every price here is also available in the cards below. It
 * earns its place by making the page feel like something that is happening
 * rather than something that was rendered, which on a product about live
 * windows is the difference between looking finished and looking correct.
 *
 * Duplicated once and translated by exactly half, so the loop is seamless
 * without measuring anything.
 */
export function Ticker({ markets }: { markets: Market[] }) {
  const { t } = useLocale();
  const reduce = useReducedMotion();

  const priced = markets.filter((m) => m.lastPrice !== null);
  if (priced.length < 2) return null;

  const row = [...priced, ...priced];

  return (
    <div
      className="relative -mx-4 overflow-hidden border-y border-border bg-bg-deep py-2.5"
      aria-hidden="true"
    >
      {/* The edges fade rather than cut, so the row reads as continuous. */}
      <span className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-bg-deep to-transparent" />
      <span className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-bg-deep to-transparent" />

      <div className={`flex w-max gap-8 ${reduce ? "" : "ticker-run"}`}>
        {row.map((m, i) => {
          const up = (m.lastPrice ?? 0.5) >= 0.5;
          return (
            <span key={`${m.marketId}-${i}`} className="flex shrink-0 items-baseline gap-2">
              <span className="font-mono text-[11px] font-semibold text-text">{m.asset}</span>
              <span className="font-mono text-[10.5px] text-muted">
                {windowLabel(m.intervalSec)}
              </span>
              <span
                className={`t-figure text-[12px] ${up ? "text-up" : "text-down"}`}
              >
                {asPercent(m.lastPrice ?? 0)}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
                {t.up}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
