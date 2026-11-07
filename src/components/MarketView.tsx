"use client";

import type { Market, Receipt } from "@/lib/indexer";
import { explorerBlockUrl, explorerTxUrl } from "@/lib/somnia";
import { useLocale } from "./LocaleProvider";
import { CallCard } from "./CallCard";
import { ClockProvider, Countdown } from "./Clock";
import { LivePercent, WindowRing } from "./LiveNumber";
import { Sparkline } from "./Sparkline";
import { Empty } from "./Empty";
import { money, usd, windowLabel } from "@/lib/format";
import type { ScoredCall } from "./FeedView";

/**
 * Why a settled window went the way it did, from the chain's own records.
 *
 * The line it opened against, the price the oracle published at the close, and
 * the transaction that settled it on the testnet explorer. Every card's "see
 * why" lands here.
 */
function ReceiptPanel({ market, receipt }: { market: Market; receipt: Receipt | null }) {
  const { t } = useLocale();
  const link = receipt?.txHash
    ? explorerTxUrl(receipt.txHash)
    : receipt?.block
      ? explorerBlockUrl(receipt.block)
      : null;

  return (
    <section
      id="recibo"
      className="mt-4 scroll-mt-24 rounded-2xl border border-gold/25 bg-surface-2 p-5 sm:p-6"
    >
      <h2 className="t-label text-gold">{t.receiptTitle}</h2>

      {receipt === null ? (
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{t.receiptUnavailable}</p>
      ) : (
        <>
          {(receipt.line !== null || receipt.close !== null) && (
            <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
              {receipt.line !== null && (
                <div>
                  <dt className="t-label">{t.receiptLine}</dt>
                  <dd className="t-figure mt-1 text-[19px] text-text">{usd(receipt.line)}</dd>
                </div>
              )}
              {receipt.close !== null && (
                <div>
                  <dt className="t-label">{t.receiptClose}</dt>
                  <dd className="t-figure mt-1 text-[19px] text-text">{usd(receipt.close)}</dd>
                </div>
              )}
            </dl>
          )}
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            {market.voided
              ? t.receiptVoided
              : receipt.line !== null && receipt.close !== null
                ? receipt.close >= receipt.line
                  ? t.receiptRuleUp
                  : t.receiptRuleDown
                : t.receiptRuleOld}
          </p>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-gold transition-colors hover:text-gold/80"
            >
              {receipt.txHash ? t.receiptTx : t.receiptBlock}
              <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                →
              </span>
            </a>
          )}
          <p className="mt-3 text-[12px] leading-relaxed text-faint">{t.receiptBody}</p>
        </>
      )}
    </section>
  );
}

export function MarketView({
  market,
  scored,
  serverNow,
  receipt = null,
}: {
  market: Market;
  scored: ScoredCall[];
  serverNow: number;
  receipt?: Receipt | null;
}) {
  const { t, locale } = useLocale();
  const live = market.expiry > serverNow;
  const settling = !live && !market.finalized;

  return (
    <ClockProvider now={serverNow}>
      <header className="lit-edge rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="t-display text-[clamp(1.6rem,5vw,2.3rem)]">{market.asset}</h1>
            <span className="mt-1 inline-block rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted">
              {windowLabel(market.intervalSec)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {live ? (
              <WindowRing start={market.tradingStart} expiry={market.expiry} size={44}>
                <Countdown expiry={market.expiry} className="t-figure text-[11px] text-text" />
              </WindowRing>
            ) : settling ? (
              <span className="rounded-md bg-surface-3 px-2 py-1 text-[11px] font-semibold text-muted">
                {t.settling}
              </span>
            ) : market.voided ? (
              <span className="rounded-md bg-surface-3 px-2 py-1 text-[11px] font-semibold text-muted">
                {t.void}
              </span>
            ) : (
              <span className="rounded-md bg-surface-3 px-2 py-1 text-[11px] font-semibold text-text">
                {market.winningOutcome === 0 ? t.marketClosedUp : t.marketClosedDown}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
          <span>
            {market.lastPrice === null ? (
              <span className="t-figure block text-[26px] text-faint">{t.noQuote}</span>
            ) : (
              <LivePercent value={market.lastPrice} className="t-figure block text-[26px] text-text" />
            )}
            <span className="t-label mt-0.5 block">{t.lblPrice}</span>
          </span>
          <span>
            <span className="t-figure block text-[19px] text-text">
              {money(market.volume, locale)}
            </span>
            <span className="t-label mt-0.5 block">{t.marketVolume} · tUSDC</span>
          </span>
          <span>
            <span className="t-figure block text-[19px] text-text">{market.tradeCount}</span>
            <span className="t-label mt-0.5 block">{t.marketTrades}</span>
          </span>
          <Sparkline points={market.spark} className="ml-auto h-8 w-[120px] text-faint" />
        </div>
      </header>

      {market.finalized && <ReceiptPanel market={market} receipt={receipt} />}

      <section className="mt-6">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-faint">{t.calls}</h2>
        {scored.length === 0 ? (
          <div className="mt-3">
            {/* This page has no composer, so "write it above" would point at nothing. */}
            {live ? (
              <Empty title={t.feedEmpty} body={t.marketEmptyLive} />
            ) : (
              <Empty title={t.marketEmptyClosed} />
            )}
          </div>
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
