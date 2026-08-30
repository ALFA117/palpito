"use client";

import type { Call, CallOutcome, Market } from "@/lib/indexer";
import { useLocale } from "./LocaleProvider";
import { CallCard } from "./CallCard";
import { ClockProvider, Countdown } from "./Clock";
import { asPercent, windowLabel } from "@/lib/format";

export interface ScoredCall {
  call: Call;
  outcome: CallOutcome;
}

function Hero() {
  const { t } = useLocale();
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{t.tagline}</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{t.whatIsThisBody}</p>
    </section>
  );
}

/** The windows a call can be made on right now, cheapest possible explanation of "live". */
function LiveWindows({ markets }: { markets: Market[] }) {
  const { t } = useLocale();
  if (markets.length === 0) return null;

  return (
    <section className="mt-5">
      <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-faint">
        <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-gold" />
        {t.liveNow}
      </h2>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {markets.slice(0, 8).map((m) => (
          <div
            key={m.marketId}
            className="shrink-0 rounded-lg border border-border bg-surface px-3 py-2"
          >
            <div className="flex items-baseline gap-1.5">
              <span className="text-[13px] font-semibold">{m.asset}</span>
              <span className="font-mono text-[10px] text-faint">{windowLabel(m.intervalSec)}</span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-2 text-[11px]">
              <span className="text-up">
                {t.up} {m.lastPrice === null ? "—" : asPercent(m.lastPrice)}
              </span>
              <Countdown expiry={m.expiry} className="font-mono text-faint" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FeedView({
  scored,
  markets,
  serverNow,
}: {
  scored: ScoredCall[];
  markets: Market[];
  serverNow: number;
}) {
  const { t } = useLocale();

  return (
    <ClockProvider now={serverNow}>
      <Hero />
      <LiveWindows markets={markets} />

      <section className="mt-6">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-faint">
          {t.feedTitle}
        </h2>
        {scored.length === 0 ? (
          <p className="mt-3 rounded-xl border border-border bg-surface p-5 text-[13px] text-muted">
            {t.feedEmpty}
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
