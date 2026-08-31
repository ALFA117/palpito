"use client";

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

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="flex-1 rounded-2xl border border-border bg-surface-2 px-4 py-3.5">
      <div
        className={`t-figure text-[26px] ${
          tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-text"
        }`}
      >
        {value}
      </div>
      <div className="t-label mt-1">{label}</div>
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
          />
          <Stat label={t.settledCalls} value={String(settled)} />
          <Stat
            label={t.pnl}
            value={signedMoney(standing.pnl, locale)}
            tone={standing.pnl >= 0 ? "up" : "down"}
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
          <p className="mt-3 rounded-xl border border-border bg-surface p-5 text-[13px] text-muted">
            {t.noRecordYet}
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {scored.map(({ call, outcome }) => (
              <CallCard key={call.id} call={call} outcome={outcome} />
            ))}
          </div>
        )}
      </section>
    </ClockProvider>
  );
}
