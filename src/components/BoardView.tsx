"use client";

import { NavLink } from "./RouteProgress";
import { BOARD_RANGES, type BoardRange } from "@/lib/indexer";
import type { Standing } from "@/lib/indexer";
import { useLocale } from "./LocaleProvider";
import { handleFor, shortAddress, signedMoney } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import { Empty } from "./Empty";

const RANGE_LABEL: Record<BoardRange, keyof Dict> = {
  "24h": "range24h",
  "7d": "range7d",
  all: "rangeAll",
};

export function BoardView({
  standings,
  range,
}: {
  standings: Standing[];
  range: BoardRange;
}) {
  const { t, locale } = useLocale();

  return (
    <div>
      <header>
        <h1 className="t-display">{t.boardTitle}</h1>
        <p className="mt-3 max-w-[46ch] text-[15px] text-muted">{t.boardSub}</p>
        <p className="t-label mt-2">{t.boardMin}</p>

        {/* Links rather than buttons: each range is a real URL, so a board worth
            sharing can be shared. */}
        <nav className="mt-3 flex gap-1.5">
          {BOARD_RANGES.map((r) => (
            <NavLink
              key={r}
              href={r === "24h" ? "/ranking" : `/ranking?r=${r}`}
              aria-current={r === range ? "page" : undefined}
              className={`rounded-xl border px-3.5 py-2 text-[12px] font-medium transition-colors ${
                r === range
                  ? "border-gold/50 bg-surface-2 text-text"
                  : "border-border bg-surface text-muted hover:text-text"
              }`}
            >
              {t[RANGE_LABEL[r]]}
            </NavLink>
          ))}
        </nav>
      </header>

      {standings.length === 0 ? (
        <div className="mt-5">
          <Empty title={t.boardEmptyRange} body={t.boardEmptyRangeWhy} />
        </div>
      ) : (
        <ol className="mt-5 flex flex-col gap-2">
          {standings.map((s, i) => (
            <li key={s.wallet}>
              <NavLink
                href={`/u/${s.wallet}`}
                className={`lift flex items-center gap-3 rounded-2xl border p-4 ${
                  i === 0
                    ? "tint-gold bg-surface border-gold/40 glow-gold"
                    : i < 3
                      ? "border-border-bright bg-surface"
                      : "border-border bg-surface"
                }`}
              >
                <span
                  className={`t-figure w-7 shrink-0 text-center ${
                    i === 0 ? "text-[19px] text-gold" : i < 3 ? "text-[16px] text-muted" : "text-[15px] text-faint"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="t-title block truncate text-[15px]">
                    {handleFor(s.wallet)}
                  </span>
                  <span className="block font-mono text-[11px] text-faint">
                    {shortAddress(s.wallet)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="t-figure block text-[20px]">
                    {Math.round((s.hitRate ?? 0) * 100)}%
                  </span>
                  <span className="block text-[10px] text-faint">
                    {s.won + s.lost} {t.settledCalls}
                  </span>
                </span>
                <span className="w-20 shrink-0 text-right">
                  <span
                    className={`t-figure block text-[14px] ${
                      s.pnl >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {signedMoney(s.pnl, locale)}
                  </span>
                  <span className="block text-[10px] text-faint">tUSDC</span>
                </span>
              </NavLink>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
