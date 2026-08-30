"use client";

import type { Call } from "@/lib/indexer";
import { explorerTxUrl } from "@/lib/somnia";
import { money } from "@/lib/format";
import { copyStake, useJoin } from "@/lib/useJoin";
import { useLocale } from "./LocaleProvider";

const chip =
  "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50";

/**
 * One-tap agreement and disagreement on someone else's live call.
 *
 * The fade button is the more interesting half. Event contracts settle a
 * crossing of Buy Up × Buy Down by minting a fresh pair, so two opposite-side
 * buyers need no seller and no market maker — taking the other side of a call
 * in this feed is not just a trade against someone, it is the liquidity event
 * itself. That is a strange property for a venue and an ordinary one for a
 * social feed, which is the whole reason this button exists next to the other.
 */
export function JoinButtons({ call }: { call: Call }) {
  const { t, locale } = useLocale();
  const { phase, run, connected } = useJoin();

  const amount = copyStake(call.stake);
  const busy = phase.k === "placing";

  if (phase.k === "done") {
    const nothingFilled = phase.filled === 0;
    return (
      <span className="flex items-center gap-2 text-[11px]">
        <span className={nothingFilled ? "text-muted" : "text-up"}>
          {nothingFilled ? t.noFill : t.joined}
        </span>
        <a
          href={explorerTxUrl(phase.hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-faint hover:text-muted"
        >
          {phase.hash.slice(0, 8)}
        </a>
      </span>
    );
  }

  if (!connected) {
    return <span className="text-[11px] text-faint">{t.connectToJoin}</span>;
  }

  const error =
    phase.k === "error"
      ? phase.code === "nobook"
        ? t.joinNoBook
        : phase.code === "funds"
          ? t.joinFunds
          : phase.code === "closed"
            ? t.joinClosed
            : phase.code === "rejected"
              ? t.errRejected
              : t.joinFailed
      : null;

  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void run({ market: call.market, direction: call.direction, stake: amount })}
        className={`${chip} border-up/40 text-up hover:bg-up-dim`}
      >
        {busy ? t.joining : `${t.joinCall} · ${money(amount, locale)}`}
      </button>
      <button
        type="button"
        disabled={busy}
        title={t.fadeWhy}
        onClick={() =>
          void run({
            market: call.market,
            direction: call.direction === "UP" ? "DOWN" : "UP",
            stake: amount,
          })
        }
        className={`${chip} cursor-help border-down/40 text-down hover:bg-down-dim`}
      >
        {t.fadeCall}
      </button>
      {error && <span className="text-[11px] text-muted">{error}</span>}
    </span>
  );
}
