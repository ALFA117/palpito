"use client";

import { NavLink } from "./RouteProgress";
import { BOARD_RANGES, type BoardRange } from "@/lib/indexer";
import type { Standing } from "@/lib/indexer";
import { useLocale } from "./LocaleProvider";
import { handleFor, shortAddress, shortDate, signedMoney } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import { Empty } from "./Empty";

const RANGE_LABEL: Record<BoardRange, keyof Dict> = {
  "24h": "range24h",
  "7d": "range7d",
  "30d": "range30d",
};

export function BoardView({
  standings,
  range,
  truncatedSince,
}: {
  standings: Standing[];
  range: BoardRange;
  /** Oldest call counted, when the scan ran out before the start of the range. */
  truncatedSince: number | null;
}) {
  const { t, locale } = useLocale();

  return (
    // Two columns on wide screens — the brief on the left, the standings on the
    // right — so the page fills the same frame as the header instead of
    // floating as a narrow strip in the middle.
    <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-14">
      <header className="lg:sticky lg:top-24 lg:self-start">
        <h1 className="t-display">{t.boardTitle}</h1>
        <p className="mt-3 max-w-[46ch] text-[16px] leading-relaxed text-muted">{t.boardSub}</p>
        <p className="t-label mt-3">{t.boardMin}</p>

        {/* Links rather than buttons: each range is a real URL, so a board worth
            sharing can be shared. */}
        <nav className="mt-5 inline-flex rounded-md border border-border bg-surface p-0.5">
          {BOARD_RANGES.map((r) => (
            <NavLink
              key={r}
              href={r === "24h" ? "/ranking" : `/ranking?r=${r}`}
              aria-current={r === range ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-[5px] px-4 text-[13px] font-medium transition-colors ${
                r === range ? "bg-text text-bg" : "text-muted hover:text-text"
              }`}
            >
              {t[RANGE_LABEL[r]]}
            </NavLink>
          ))}
        </nav>
        {truncatedSince !== null && (
          <p className="mt-3 max-w-[60ch] text-[13px] leading-relaxed text-faint">
            {t.boardTruncated.replace("{date}", shortDate(truncatedSince, locale))}
          </p>
        )}
      </header>

      <div className="min-w-0">
        {standings.length === 0 ? (
          <Empty title={t.boardEmptyRange} body={t.boardEmptyRangeWhy} />
        ) : (
          <ol className="overflow-hidden rounded-lg border border-border bg-surface">
            <li
              aria-hidden="true"
              className="hidden items-center gap-3 border-b border-border bg-surface-2 px-4 py-2.5 sm:flex"
            >
              <span className="t-label w-7 text-center">#</span>
              <span className="t-label flex-1">Wallet</span>
              <span className="t-label w-24 text-right">%</span>
              <span className="t-label w-24 text-right">P&amp;L</span>
            </li>
            {standings.map((s, i) => (
              <li key={s.wallet} className="border-b border-border last:border-b-0">
                <NavLink
                  href={`/u/${s.wallet}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2"
                >
                  <span
                    className={`t-figure w-7 shrink-0 text-center text-[15px] ${
                      i === 0 ? "font-semibold text-gold" : i < 3 ? "text-text" : "text-faint"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="t-title block truncate text-[15px]">{handleFor(s.wallet)}</span>
                    <span className="block font-mono text-[12px] text-faint">{shortAddress(s.wallet)}</span>
                  </span>
                  <span className="w-20 shrink-0 text-right sm:w-24">
                    <span className="t-figure block text-[18px]">
                      {Math.round((s.hitRate ?? 0) * 100)}%
                    </span>
                    <span className="block text-[12px] text-faint">
                      {s.won + s.lost} {t.settledCalls}
                    </span>
                  </span>
                  <span className="w-20 shrink-0 text-right sm:w-24">
                    <span className={`t-figure block text-[14px] ${s.pnl >= 0 ? "text-up" : "text-down"}`}>
                      {signedMoney(s.pnl, locale)}
                    </span>
                    <span className="block text-[12px] text-faint">tUSDC</span>
                  </span>
                </NavLink>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
