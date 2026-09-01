"use client";

import type { Call } from "@/lib/indexer";
import { explorerTxUrl } from "@/lib/somnia";
import { money } from "@/lib/format";
import { copyStake, useJoin } from "@/lib/useJoin";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLocale } from "./LocaleProvider";

const chip =
  "min-h-[34px] rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-40";

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
  const reduce = useReducedMotion();
  const { phase, run, connected } = useJoin();
  // Why fading matters was in a `title`, which on a phone is nowhere. It is the
  // one idea the whole pitch rests on, so it gets a real affordance.
  const [showFadeWhy, setShowFadeWhy] = useState(false);

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
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <motion.button
        type="button"
        disabled={busy}
        onClick={() => void run({ market: call.market, direction: call.direction, stake: amount })}
        whileTap={reduce || busy ? undefined : { scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className={`${chip} border-up/40 bg-up-dim/30 text-up hover:bg-up-dim`}
      >
        {busy ? t.joining : `${t.joinCall} · ${money(amount, locale)}`}
      </motion.button>
      <motion.button
        type="button"
        disabled={busy}
        onClick={() =>
          void run({
            market: call.market,
            direction: call.direction === "UP" ? "DOWN" : "UP",
            stake: amount,
          })
        }
        whileTap={reduce || busy ? undefined : { scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className={`${chip} border-down/40 bg-down-dim/30 text-down hover:bg-down-dim`}
      >
        {t.fadeCall}
      </motion.button>

      <button
        type="button"
        aria-expanded={showFadeWhy}
        aria-label={t.fadeWhyLabel}
        onClick={() => setShowFadeWhy((v) => !v)}
        className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-border text-[11px] text-faint transition-colors hover:border-gold/40 hover:text-gold"
      >
        ?
      </button>

      <AnimatePresence initial={false}>
        {showFadeWhy && (
          <motion.span
            initial={reduce ? undefined : { opacity: 0, height: 0 }}
            animate={reduce ? undefined : { opacity: 1, height: "auto" }}
            exit={reduce ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="block w-full overflow-hidden"
          >
            <span className="mt-1 block rounded-lg border border-down/20 bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-muted">
              {t.fadeWhy}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
      {error && <span className="text-[11px] text-muted">{error}</span>}
    </span>
  );
}
