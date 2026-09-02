"use client";

import { useState } from "react";
import type { Standing } from "@/lib/indexer";
import { useLocale } from "./LocaleProvider";
import { CallCard } from "./CallCard";
import { ClockProvider } from "./Clock";
import { Calibration } from "./Calibration";
import { Positions } from "./Positions";
import { useAccount } from "wagmi";
import type { ScoredCall } from "./FeedView";
import { explorerAddressUrl } from "@/lib/somnia";
import { handleFor, shortAddress, signedMoney } from "@/lib/format";
import { Empty } from "./Empty";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div
      className={`lift flex-1 rounded-2xl border px-4 py-4 ${
        tone === "up"
          ? "tint-up bg-surface-2 border-up/30 glow-up"
          : tone === "down"
            ? "tint-down bg-surface-2 border-down/30 glow-down"
            : "border-border bg-surface-2"
      }`}
    >
      <div
        className={`t-figure text-[22px] sm:text-[30px] ${
          tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-text"
        }`}
      >
        {value}
      </div>
      <div className="t-label mt-1.5">{label}</div>
    </div>
  );
}

export function ProfileView({
  standing,
  scored,
  serverNow,
}: {
  standing: Standing;
  scored: ScoredCall[];
  serverNow: number;
}) {
  const { t, locale } = useLocale();
  const { address } = useAccount();
  const settled = standing.won + standing.lost;
  // Positions are a control surface, not a public fact: only shown when you are
  // looking at your own record.
  const isMe = address?.toLowerCase() === standing.wallet.toLowerCase();

  // The full history is already in `scored` — `buildStanding` needed all of it
  // for a correct hit rate, so there was no cheaper fetch to make. What was
  // expensive was rendering up to 200 cards on first paint; this reveals them
  // in pages instead, from data already on the page.
  const PAGE = 40;
  const [shown, setShown] = useState(PAGE);
  const visible = scored.slice(0, shown);

  return (
    <ClockProvider now={serverNow}>
      <header className="lit-edge rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h1 className="t-display text-[clamp(1.6rem,5vw,2.3rem)]">{handleFor(standing.wallet)}</h1>
        <a
          href={explorerAddressUrl(standing.wallet)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 block font-mono text-[11px] text-faint hover:text-muted"
        >
          {shortAddress(standing.wallet)}
        </a>

        <div className="mt-4 flex gap-2">
          <Stat
            label={t.hitRate}
            value={standing.hitRate === null ? "—" : `${Math.round(standing.hitRate * 100)}%`}
            // Half is the coin flip; above it is skill, below it is not.
            tone={
              standing.hitRate === null ? undefined : standing.hitRate >= 0.5 ? "up" : "down"
            }
          />
          <Stat label={t.settledCalls} value={String(settled)} />
          <Stat
            label={t.pnl}
            value={signedMoney(standing.pnl, locale)}
            // Exactly zero is neither, and a glowing green nought on an empty
            // profile claims a result nobody earned.
            tone={standing.pnl === 0 ? undefined : standing.pnl > 0 ? "up" : "down"}
          />
        </div>

        {standing.streak !== 0 && (
          <p className="mt-3 text-[12px]">
            <span
              className={`font-mono text-[15px] font-semibold ${
                standing.streak > 0 ? "text-up" : "text-down"
              }`}
            >
              {Math.abs(standing.streak)}
            </span>{" "}
            <span className="text-muted">
              {standing.streak > 0 ? t.winStreak : t.lossStreak}
            </span>
          </p>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-faint">{t.receiptBody}</p>
      </header>

      {isMe && <Positions />}

      <section className="mt-6">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-faint">
          {t.calibration}
        </h2>
        <p className="mt-1 max-w-prose text-[11px] leading-relaxed text-faint">
          {t.calibrationWhy}
        </p>
        <Calibration bands={standing.calibration} />
      </section>

      <section className="mt-6">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-faint">{t.calls}</h2>
        {scored.length === 0 ? (
          <div className="mt-3">
            <Empty title={t.noRecordYet} body={t.noRecordYetWhy} />
          </div>
        ) : (
          <>
            <div className="mt-3 flex flex-col gap-3">
              {visible.map(({ call, outcome }) => (
                <CallCard key={call.id} call={call} outcome={outcome} />
              ))}
            </div>
            {shown < scored.length && (
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="mt-4 w-full rounded-xl border border-border bg-surface py-2.5 text-[12px] font-medium text-muted transition-colors hover:border-border-bright hover:text-text"
              >
                {t.loadMore}
              </button>
            )}
          </>
        )}
      </section>
    </ClockProvider>
  );
}
