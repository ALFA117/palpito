"use client";

import type { CalibrationBand } from "@/lib/indexer";
import { useLocale } from "./LocaleProvider";

/** Inside this much of their own claim, someone is telling the truth about themselves. */
const TOLERANCE = 0.08;

/**
 * Claim versus outcome, by confidence band.
 *
 * The price someone pays IS their stated confidence — 0.83 for UP is "I think
 * this is 83% likely" — so putting it next to how often they were actually right
 * says something a hit rate cannot. A trader here can sit at 37% overall and be
 * well calibrated everywhere except one band where they are wildly overconfident;
 * that band is the useful thing to know about them, and the single number buries it.
 */
export function Calibration({ bands }: { bands: CalibrationBand[] }) {
  const { t } = useLocale();

  if (bands.length === 0) {
    return <p className="mt-3 text-[13px] text-muted">{t.notEnoughHistory}</p>;
  }

  return (
    <ul className="mt-3 flex flex-col gap-2">
      {bands.map((b) => {
        const gap = b.actual - b.claimed;
        const verdict =
          Math.abs(gap) < TOLERANCE ? "ok" : gap > 0 ? "modest" : "over";
        const label =
          verdict === "ok" ? t.calibrated : verdict === "modest" ? t.modest : t.overconfident;
        const tone =
          verdict === "ok" ? "text-muted" : verdict === "modest" ? "text-up" : "text-down";

        return (
          <li
            key={b.from}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-[12px]"
          >
            <span className="text-faint">{t.said}</span>
            <span className="t-figure w-11 text-right text-[17px] text-text">
              {Math.round(b.claimed * 100)}%
            </span>

            <span aria-hidden="true" className="text-faint">→</span>

            <span className="text-faint">{t.wasRight}</span>
            <span
              className={`t-figure w-11 text-right text-[17px] ${
                verdict === "ok" ? "text-text" : tone
              }`}
            >
              {Math.round(b.actual * 100)}%
            </span>

            {/* The bar is the claim; the marker is the outcome. Distance between
                them is the whole point, so it is shown rather than described. */}
            <span className="relative mx-1 hidden h-1.5 min-w-24 flex-1 rounded-full bg-border sm:block">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-faint/70"
                style={{ width: `${b.claimed * 100}%` }}
              />
              <span
                className={`absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 ${
                  verdict === "ok" ? "bg-text" : verdict === "modest" ? "bg-up" : "bg-down"
                }`}
                style={{ left: `${b.actual * 100}%` }}
              />
            </span>

            <span className={`text-[11px] ${tone}`}>{label}</span>
            <span className="font-mono text-[10px] text-faint">n={b.n}</span>
          </li>
        );
      })}
    </ul>
  );
}
