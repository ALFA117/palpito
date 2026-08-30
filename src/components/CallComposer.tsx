"use client";

import { useMemo, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import type { Direction, Market } from "@/lib/indexer";
import { CHAIN_ID, ONE, explorerTxUrl } from "@/lib/somnia";
import { asPercent, money, windowLabel } from "@/lib/format";
import { placeCall } from "@/lib/trade";
import { useCollateralBalance, useFaucet } from "@/lib/useCollateral";
import { useBook } from "@/lib/useBook";
import { useLocale } from "./LocaleProvider";
import { Countdown } from "./Clock";
import { HunchInput } from "./HunchInput";
import type { Hunch } from "@/lib/parse";

/**
 * How far past the quoted price an order may fill.
 *
 * The book moves between the page render and the signature, and an IOC that
 * cannot cross fills nothing. Five points of headroom is generous enough to
 * cross a stale quote and tight enough that nobody pays 0.95 for a coin flip.
 */
const SLIPPAGE = 0.05;

const STAKES = [1, 5, 10, 25];


type Phase =
  | { k: "idle" }
  | { k: "placing" }
  | { k: "placed"; hash: string; filled: number }
  | { k: "error"; code: string };

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  render,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  render: (v: T) => React.ReactNode;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={String(opt)}
          type="button"
          role="radio"
          aria-checked={opt === value}
          onClick={() => onChange(opt)}
          className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
            opt === value
              ? "border-gold/50 bg-surface-2 text-text"
              : "border-border bg-surface text-muted hover:text-text"
          }`}
        >
          {render(opt)}
        </button>
      ))}
    </div>
  );
}

export function CallComposer({ markets }: { markets: Market[] }) {
  const { t, locale } = useLocale();
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: CHAIN_ID });
  const { raw: balance, formatted, refetch } = useCollateralBalance(address);
  const faucet = useFaucet(() => void refetch());

  const [asset, setAsset] = useState("BTC");
  const [intervalSec, setIntervalSec] = useState<number | null>(null);
  const [direction, setDirection] = useState<Direction>("UP");
  const [stake, setStake] = useState(5);
  const [phase, setPhase] = useState<Phase>({ k: "idle" });

  const assets = useMemo(
    () => [...new Set(markets.map((m) => m.asset))].sort(),
    [markets],
  );
  /** Every window live on the venue, for reading a sentence before an asset is picked. */
  const allWindows = useMemo(
    () => [...new Set(markets.map((m) => m.intervalSec))].sort((a, b) => a - b),
    [markets],
  );
  const windows = useMemo(
    () =>
      [...new Set(markets.filter((m) => m.asset === asset).map((m) => m.intervalSec))].sort(
        (a, b) => a - b,
      ),
    [markets, asset],
  );

  const activeInterval = intervalSec !== null && windows.includes(intervalSec) ? intervalSec : windows[0];
  const market = markets.find((m) => m.asset === asset && m.intervalSec === activeInterval);

  // Quoted from the live book, not from the market's last trade — see useBook.
  const { data: book, isLoading: bookLoading } = useBook(market?.poolAddress);
  const quote = direction === "UP" ? book?.up : book?.down;
  const price = quote?.price ?? null;
  const contracts = price && price > 0 ? stake / price : 0;

  // An IOC against an empty side fills nothing, so the button has to know.
  const hasLiquidity = Boolean(quote && quote.size > 0);

  const canAfford = balance !== undefined && Number(balance) / ONE >= stake;
  const wrongChain = isConnected && chainId !== CHAIN_ID;
  const ready =
    isConnected && !wrongChain && walletClient && market && canAfford && hasLiquidity && price;

  /** Apply whatever a sentence yielded, leaving anything it did not name alone. */
  function applyHunch(h: Hunch) {
    if (h.asset) setAsset(h.asset);
    if (h.direction) setDirection(h.direction);
    if (h.windowSec !== null) setIntervalSec(h.windowSec);
    if (h.stake !== null) setStake(h.stake);
    setPhase({ k: "idle" });
  }

  async function submit() {
    if (!walletClient || !market || !price) return;
    setPhase({ k: "placing" });
    try {
      const res = await placeCall({
        walletClient,
        marketId: market.marketId,
        direction,
        contracts,
        limitProbability: Math.min((price ?? 0) + SLIPPAGE, 0.99),
      });
      setPhase({ k: "placed", hash: res.hash, filled: res.filled });
      void refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = msg.includes("MARKET_CLOSED")
        ? "closed"
        : /user rejected|denied|UserRejected/i.test(msg)
          ? "rejected"
          : "generic";
      setPhase({ k: "error", code });
    }
  }

  if (markets.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-5 text-[13px] text-muted">
        {t.noLiveWindows}
      </section>
    );
  }

  if (phase.k === "placed") {
    const nothingFilled = phase.filled === 0;
    return (
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className={`text-[16px] font-semibold ${nothingFilled ? "text-muted" : "text-up"}`}>
          {nothingFilled ? t.noFill : t.placedTitle}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          {nothingFilled ? t.noFillBody : t.placedBody}
        </p>
        <div className="mt-3 flex items-center gap-3 text-[12px]">
          <a
            href={explorerTxUrl(phase.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gold hover:underline"
          >
            {t.viewTx} →
          </a>
          <button
            type="button"
            onClick={() => setPhase({ k: "idle" })}
            className="text-muted hover:text-text"
          >
            {t.composerTitle}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-[16px] font-semibold tracking-tight">{t.composerTitle}</h2>

      <div className="mt-4 space-y-3.5">
        <HunchInput windows={allWindows} onResolved={applyHunch} />

        <div className="h-px bg-border" />

        <div>
          <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-faint">
            {t.asset}
          </label>
          <Segmented
            label={t.asset}
            options={assets}
            value={asset}
            onChange={setAsset}
            render={(a) => a}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-faint">
            {t.pickWindow}
          </label>
          <Segmented
            label={t.pickWindow}
            options={windows}
            value={activeInterval}
            onChange={setIntervalSec}
            render={(w) => {
              const m = markets.find((x) => x.asset === asset && x.intervalSec === w);
              return (
                <span className="flex items-baseline gap-1.5">
                  {windowLabel(w)}
                  {m && <Countdown expiry={m.expiry} className="font-mono text-[10px] text-faint" />}
                </span>
              );
            }}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-faint">
            {t.pickSide}
          </label>
          <div role="radiogroup" aria-label={t.pickSide} className="flex gap-2">
            {(["UP", "DOWN"] as const).map((d) => {
              const on = d === direction;
              const q = d === "UP" ? book?.up : book?.down;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setDirection(d)}
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    on
                      ? d === "UP"
                        ? "border-up/60 bg-up-dim"
                        : "border-down/60 bg-down-dim"
                      : "border-border bg-surface hover:border-faint"
                  }`}
                >
                  <span
                    className={`block text-[14px] font-semibold ${
                      d === "UP" ? "text-up" : "text-down"
                    }`}
                  >
                    {d === "UP" ? `▲ ${t.up}` : `▼ ${t.down}`}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-muted">
                    {q ? asPercent(q.price) : bookLoading ? "..." : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-faint">
            {t.amount}
          </label>
          <Segmented
            label={t.amount}
            options={STAKES.includes(stake) ? STAKES : [...STAKES, stake].sort((a, b) => a - b)}
            value={stake}
            onChange={setStake}
            render={(s) => `${s} tUSDC`}
          />
        </div>

        <dl className="flex gap-6 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[12px]">
          <div>
            <dt className="text-faint">{t.youRisk}</dt>
            <dd className="mt-0.5 font-mono text-[14px] text-text">{money(stake, locale)}</dd>
          </div>
          <div>
            <dt className="text-faint">{t.youWinIfRight}</dt>
            <dd className="mt-0.5 font-mono text-[14px] text-up">
              {price ? money(contracts, locale) : "—"}
            </dd>
          </div>
        </dl>
      </div>

      {phase.k === "error" && (
        <p className="mt-3 rounded-lg border border-down/40 bg-down-dim px-3 py-2 text-[12px] text-down">
          {phase.code === "closed"
            ? t.errMarketClosed
            : phase.code === "rejected"
              ? t.errRejected
              : t.errGeneric}
        </p>
      )}

      <div className="mt-4">
        {!isConnected ? (
          <p className="text-[13px] text-muted">{t.connectFirst}</p>
        ) : !canAfford ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={faucet.isPending}
              onClick={() => faucet.request()}
              className="rounded-lg bg-gold px-4 py-2.5 text-[13px] font-semibold text-[#191014] transition-colors hover:bg-gold/90 disabled:opacity-60"
            >
              {faucet.isPending ? t.faucetPending : t.faucet}
            </button>
            <span className="text-[12px] text-muted">
              {t.needFunds} <span className="text-faint">{t.faucetHelp}</span>{" "}
              {/* The faucet call itself costs gas, so an empty STT balance looks
                  like a broken faucet button unless we name it here. */}
              <span className="text-faint">
                {t.needGas}{" "}
                <a
                  href="https://testnet.somnia.network/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold hover:underline"
                >
                  {t.getGas} →
                </a>
              </span>
            </span>
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={!ready || phase.k === "placing"}
              onClick={submit}
              className="w-full rounded-lg bg-gold px-4 py-3 text-[14px] font-semibold text-[#191014] transition-colors hover:bg-gold/90 disabled:opacity-50"
            >
              {phase.k === "placing" ? t.placing : t.placeCall}
            </button>
            {!hasLiquidity && !bookLoading && (
              <p className="mt-2 text-[12px] text-muted">{t.noBookSide}</p>
            )}
          </>
        )}
        {isConnected && formatted && (
          <p className="mt-2 text-right font-mono text-[11px] text-faint">{formatted} tUSDC</p>
        )}
      </div>
    </section>
  );
}
