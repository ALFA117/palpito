"use client";

import Link from "next/link";
import { BOARD_RANGES, type BoardRange } from "@/lib/indexer";
import type { Standing } from "@/lib/indexer";
import { useLocale } from "./LocaleProvider";
import { handleFor, shortAddress, signedMoney } from "@/lib/format";
import type { Dict } from "@/lib/i18n";

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
        <h1 className="text-[22px] font-semibold tracking-tight">{t.boardTitle}</h1>
        <p className="mt-1 text-[13px] text-muted">{t.boardSub}</p>
        <p className="mt-0.5 text-[11px] text-faint">{t.boardMin}</p>

        {/* Links rather than buttons: each range is a real URL, so a board worth
            sharing can be shared. */}
        <nav className="mt-3 flex gap-1.5">
          {BOARD_RANGES.map((r) => (
            <Link
              key={r}
              href={r === "24h" ? "/ranking" : `/ranking?r=${r}`}
              aria-current={r === range ? "page" : undefined}
              className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                r === range
                  ? "border-gold/50 bg-surface-2 text-text"
                  : "border-border bg-surface text-muted hover:text-text"
              }`}
            >
              {t[RANGE_LABEL[r]]}
            </Link>
          ))}
        </nav>
      </header>

      {standings.length === 0 ? (
        <p className="mt-5 rounded-xl border border-border bg-surface p-5 text-[13px] text-muted">
          {t.boardEmptyRange}
        </p>
      ) : (
        <ol className="mt-5 flex flex-col gap-2">
          {standings.map((s, i) => (
            <li key={s.wallet}>
              <Link
                href={`/u/${s.wallet}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5 transition-colors hover:border-gold/40"
              >
                <span
                  className={`w-6 shrink-0 text-center font-mono text-[13px] ${
                    i === 0 ? "text-gold" : "text-faint"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">
                    {handleFor(s.wallet)}
                  </span>
                  <span className="block font-mono text-[11px] text-faint">
                    {shortAddress(s.wallet)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[15px] font-semibold">
                    {Math.round((s.hitRate ?? 0) * 100)}%
                  </span>
                  <span className="block text-[10px] text-faint">
                    {s.won + s.lost} {t.settledCalls}
                  </span>
                </span>
                <span className="w-20 shrink-0 text-right">
                  <span
                    className={`block font-mono text-[13px] ${
                      s.pnl >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {signedMoney(s.pnl, locale)}
                  </span>
                  <span className="block text-[10px] text-faint">tUSDC</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
