"use client";

import { useAccount } from "wagmi";
import type { Position } from "@/lib/positions";
import { usePositions } from "@/lib/usePositions";
import { useSell } from "@/lib/useSell";
import { useBook } from "@/lib/useBook";
import { estimateProceeds } from "@/lib/book";
import { explorerTxUrl } from "@/lib/somnia";
import { formatLatency, money, windowLabel } from "@/lib/format";
import { useLocale } from "./LocaleProvider";
import { Countdown } from "./Clock";

function PositionRow({ position }: { position: Position }) {
  const { t, locale } = useLocale();
  const { phase, run } = useSell();
  const { data: book } = useBook(position.market.poolAddress);

  const up = position.direction === "UP";

  // Walks the resting book rather than pricing the whole size at the top
  // level — a position bigger than what's resting there fills down into worse
  // prices on a real sell, same as it always could. Still shown with "about":
  // the book can move between this render and the signature.
  const proceeds = book ? estimateProceeds(book, position.direction, position.size) : null;

  const busy = phase.k === "selling";

  if (phase.k === "done") {
    return (
      <li className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[12px]">
        <span className={phase.filled === 0 ? "text-muted" : "text-up"}>
          {phase.filled === 0 ? t.sellNoBid : t.sold}
        </span>
        {phase.filled > 0 && phase.filled < position.size && (
          <span className="text-faint">· {t.partialFill}</span>
        )}
        {phase.filled > 0 && (
          <span className="font-mono text-faint">{formatLatency(phase.latencyMs)}</span>
        )}
        <a
          href={explorerTxUrl(phase.hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto font-mono text-[11px] text-faint hover:text-muted"
        >
          {phase.hash.slice(0, 8)}
        </a>
      </li>
    );
  }

  const error =
    phase.k === "error"
      ? phase.code === "nobid"
        ? t.sellNoBid
        : phase.code === "closed"
          ? t.sellClosed
          : phase.code === "empty"
            ? t.sellEmpty
            : phase.code === "rejected"
              ? t.errRejected
              : phase.code === "approval"
                ? t.errApproval
                : t.sellFailed
      : null;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[12px]">
      <span className="font-semibold text-text">{position.market.asset}</span>
      <span className={`font-semibold ${up ? "text-up" : "text-down"}`}>
        {up ? `▲ ${t.up}` : `▼ ${t.down}`}
      </span>
      <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">
        {windowLabel(position.market.intervalSec)}
      </span>
      <span className="text-muted">
        <span className="font-mono text-text">{money(position.size, locale)}</span> {t.contracts}
      </span>
      <span className="flex items-center gap-1.5 text-faint">
        <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-gold" />
        <Countdown expiry={position.market.expiry} className="font-mono" />
      </span>

      <span className="ml-auto flex items-center gap-2">
        {error && <span className="text-muted">{error}</span>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(position)}
          className="min-h-[36px] rounded-xl border border-gold/40 bg-gold-dim/30 px-3.5 py-2 text-[12px] font-semibold text-gold transition-colors hover:bg-gold-dim disabled:opacity-40"
        >
          {busy
            ? t.selling
            : proceeds !== null
              ? `${t.sell} · ${t.sellApprox} ${money(proceeds, locale)}`
              : t.sell}
        </button>
      </span>
    </li>
  );
}

/**
 * The exit.
 *
 * Only rendered when the connected wallet is actually holding something in an
 * open window — an empty "positions" heading on a first visit is noise, and this
 * sits directly under the composer where a call was just made.
 */
export function Positions() {
  const { t } = useLocale();
  const { address } = useAccount();
  const { data: positions } = usePositions(address);

  if (!address || !positions || positions.length === 0) return null;

  return (
    <section className="lit-edge mt-8 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="t-label">{t.yourPositions}</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-faint">{t.sellWhy}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {positions.map((p) => (
          <PositionRow key={p.id} position={p} />
        ))}
      </ul>
    </section>
  );
}
