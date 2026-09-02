"use client";

import { NavLink } from "./RouteProgress";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Call, CallOutcome } from "@/lib/indexer";
import { oracleGraphUrl, explorerTxUrl } from "@/lib/somnia";
import { asPercent, handleFor, money, shortAddress, timeAgo, windowLabel } from "@/lib/format";
import { useLocale } from "./LocaleProvider";
import { Countdown, useNow } from "./Clock";
import { JoinButtons } from "./JoinButtons";

/**
 * The direction, said once and loudly.
 *
 * Direction is the single most important thing on a card, so it gets weight and
 * a filled ground rather than sitting at the same size as everything else — the
 * flat version of this card treated the call, the stake and the timestamp as
 * equally important, which is why nothing stood out.
 */
function DirectionMark({ direction }: { direction: Call["direction"] }) {
  const { t } = useLocale();
  const up = direction === "UP";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] font-semibold ${
        up ? "bg-up-dim text-up" : "bg-down-dim text-down"
      }`}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="shrink-0">
        <path d={up ? "M5 0L10 9H0z" : "M5 10L0 1h10z"} fill="currentColor" />
      </svg>
      {up ? t.up : t.down}
    </span>
  );
}

function Verdict({ outcome }: { outcome: CallOutcome }) {
  const { t } = useLocale();
  const map: Record<CallOutcome, { label: string; cls: string }> = {
    won: { label: t.won, cls: "bg-up-dim text-up ring-1 ring-up/25" },
    lost: { label: t.lost, cls: "bg-down-dim text-down ring-1 ring-down/25" },
    void: { label: t.void, cls: "bg-surface-3 text-muted" },
    pending: { label: t.pending, cls: "bg-surface-3 text-gold" },
  };
  const v = map[outcome];
  return (
    <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${v.cls}`}>{v.label}</span>
  );
}

export function CallCard({ call, outcome }: { call: Call; outcome: CallOutcome }) {
  const { t, locale } = useLocale();
  const now = useNow();
  const reduce = useReducedMotion();
  const [showWhy, setShowWhy] = useState(false);
  const m = call.market;

  // Liveness comes from the window's own clock. `clobStatus` still reads
  // "Trading" on markets that closed weeks ago, so trusting it would put a
  // ticking countdown on a call that settled in July.
  const live = outcome === "pending" && m.expiry > now;
  const settling = outcome === "pending" && !live;
  const up = call.direction === "UP";

  return (
    <article
      className={`lit-edge lift relative overflow-hidden rounded-2xl border bg-surface ${
        live
          ? up
            ? "border-up/30 tint-up breathe-up"
            : "border-down/30 tint-down breathe-down"
          : "border-border"
      }`}
    >
      {/* A live call carries a hairline of its own direction down the left edge —
          the one place colour is allowed to encode state at a glance. */}
      {live && (
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-[2px] ${up ? "bg-up/70" : "bg-down/70"}`}
        />
      )}

      <div className="p-4 sm:p-5">
        <header className="flex items-center gap-2">
          <NavLink
            href={`/u/${call.wallet}`}
            className="t-title text-[14px] text-text transition-colors hover:text-gold"
          >
            {handleFor(call.wallet)}
          </NavLink>
          <span className="font-mono text-[10px] text-faint">{shortAddress(call.wallet)}</span>
          <span className="ml-auto font-mono text-[10px] text-faint">
            {timeAgo(call.timestamp, locale, now)}
          </span>
        </header>

        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-[15px] leading-snug">
          <span className="text-muted">{t.called}</span>
          <span className="t-title text-[17px]">{m.asset}</span>
          <DirectionMark direction={call.direction} />
          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">
            {windowLabel(m.intervalSec)}
          </span>
        </p>

        <p className="mt-1 text-[13px] text-faint">
          {call.direction === "UP" ? t.upLong : t.downLong}
        </p>

        {/* Stake and odds get the figure treatment: they are the numbers someone
            scans, and the old build rendered them at caption size. */}
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
          <span>
            <span className="t-figure block text-[19px] text-text">
              {money(call.stake, locale)}
            </span>
            <span className="t-label mt-0.5 block">{t.lblStake} · tUSDC</span>
          </span>
          <span>
            <span className={`t-figure block text-[19px] ${up ? "text-up" : "text-down"}`}>
              {asPercent(call.price)}
            </span>
            <span className="t-label mt-0.5 block">{t.lblPrice}</span>
          </span>

          <span className="ml-auto flex items-center gap-2">
            {live ? (
              <span className="flex items-center gap-2">
                <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-gold" />
                <Countdown expiry={m.expiry} className="t-figure text-[17px] text-text" />
              </span>
            ) : settling ? (
              <span className="rounded-md bg-surface-3 px-2 py-1 text-[11px] font-semibold text-muted">
                {t.settling}
              </span>
            ) : (
              <Verdict outcome={outcome} />
            )}
          </span>
        </div>

        {call.mintedPair && (
          <div className="mt-3">
            <motion.button
              type="button"
              aria-expanded={showWhy}
              onClick={() => setShowWhy((v) => !v)}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="inline-flex items-center gap-1.5 rounded-md border border-gold/25 bg-gold-dim/40 px-2 py-1 text-[10px] font-medium text-gold transition-colors hover:bg-gold-dim"
            >
              <span aria-hidden="true">◇</span>
              {t.madeLiquidity}
            </motion.button>

            <AnimatePresence initial={false}>
              {showWhy && (
                <motion.p
                  initial={reduce ? undefined : { opacity: 0, height: 0 }}
                  animate={reduce ? undefined : { opacity: 1, height: "auto" }}
                  exit={reduce ? undefined : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden text-[12px] leading-relaxed text-muted"
                >
                  <span className="mt-2 block rounded-lg border border-gold/20 bg-surface-2 px-3 py-2.5">
                    {t.madeLiquidityWhy}
                  </span>
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Only a live window can be joined; a settled call is a receipt. */}
        {live && (
          <div className="mt-4 border-t border-border pt-4">
            <JoinButtons call={call} />
          </div>
        )}

        <footer className="mt-4 flex flex-wrap items-center gap-4 text-[11px]">
          {m.oracleQuestionId && (outcome === "won" || outcome === "lost" || outcome === "void") && (
            <a
              href={oracleGraphUrl(m.oracleQuestionId)}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 font-medium text-gold transition-colors hover:text-gold/80"
            >
              {t.verify}
              <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                →
              </span>
            </a>
          )}
          {/* MINT_A_PAIR gets the translated badge above; anything else is
              shown as the indexer's own raw name rather than a guessed label —
              the venue documents four distinct crossing paths and this is the
              only one of them this app can name with confidence. */}
          {call.kind && !call.mintedPair && (
            <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-faint">
              {call.kind}
            </span>
          )}
          <a
            href={explorerTxUrl(call.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-faint transition-colors hover:text-muted"
          >
            tx {call.txHash.slice(0, 8)}
          </a>
        </footer>
      </div>
    </article>
  );
}
