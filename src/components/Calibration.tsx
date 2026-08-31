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
            className={`lift flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-[12px] ${
              verdict === "ok"
                ? "border-border bg-surface-2"
                : verdict === "modest"
                  ? "tint-up bg-surface-2 border-up/25"
                  : "tint-down bg-surface-2 border-down/25"
            }`}
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
            {/* The bar is the claim. The marker is the outcome. The lit segment
                between them is the error, which is the only part worth colouring. */}
            <span className="relative mx-1 hidden h-2 min-w-28 flex-1 overflow-hidden rounded-full bg-surface-3 sm:block">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-faint/70"
                style={{ width: `${b.claimed * 100}%` }}
              />
              <span
                className={`absolute inset-y-0 ${
                  verdict === "ok" ? "bg-text/30" : verdict === "modest" ? "bg-up/70" : "bg-down/70"
                }`}
                style={{
                  left: `${Math.min(b.claimed, b.actual) * 100}%`,
                  width: `${Math.abs(b.actual - b.claimed) * 100}%`,
                }}
              />
              <span
                className={`absolute top-1/2 h-3 w-[3px] -translate-y-1/2 rounded-full ${
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
