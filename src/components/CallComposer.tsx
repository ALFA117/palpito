"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useAccount, useWalletClient } from "wagmi";
import type { Direction, Market } from "@/lib/indexer";
import { CHAIN_ID, ONE, explorerTxUrl } from "@/lib/somnia";
import { money, windowLabel } from "@/lib/format";
import { placeCall } from "@/lib/trade";
import { useCollateralBalance, useFaucet } from "@/lib/useCollateral";
import { useBook } from "@/lib/useBook";
import { useAfterWrite } from "@/lib/useAfterWrite";
import { LivePercent } from "./LiveNumber";
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
  const reduce = useReducedMotion();
  const group = label.replace(/[^a-zA-Z]+/g, "-");

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <motion.button
            key={String(opt)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt)}
            whileTap={reduce ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="relative min-h-[38px] rounded-xl px-3.5 py-2 text-[13px] font-medium"
          >
            {active && !reduce && (
              <motion.span
                layoutId={`seg-${group}`}
                className="absolute inset-0 rounded-xl bg-surface-3 ring-1 ring-border-bright"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            {active && reduce && (
              <span className="absolute inset-0 rounded-xl bg-surface-3 ring-1 ring-border-bright" />
            )}
            <span
              className={`relative z-10 ${active ? "text-text" : "text-faint hover:text-muted"}`}
            >
              {render(opt)}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function CallComposer({ markets }: { markets: Market[] }) {
  const { t, locale } = useLocale();
  const reduce = useReducedMotion();
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: CHAIN_ID });
  const { raw: balance, formatted, refetch } = useCollateralBalance(address, locale);
  const faucet = useFaucet(() => void refetch());
  const afterWrite = useAfterWrite();

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
      afterWrite();
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
      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="text-[14px] font-semibold text-text">{t.noLiveWindows}</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{t.noLiveWindowsWhy}</p>
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
    <section className="lit-edge rounded-2xl border border-border-bright bg-surface p-5 sm:p-6">
      <h2 className="t-title text-[19px]">{t.composerTitle}</h2>

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
                <motion.button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setDirection(d)}
                  whileTap={reduce ? undefined : { scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className={`flex-1 rounded-2xl border px-4 py-4 text-left transition-colors ${
                    on
                      ? d === "UP"
                        ? "border-up/60 bg-up-dim tint-up breathe-up"
                        : "border-down/60 bg-down-dim tint-down breathe-down"
                      : "lift border-border bg-surface hover:border-border-bright"
                  }`}
                >
                  <span
                    className={`flex items-center gap-1.5 text-[15px] font-semibold ${
                      d === "UP" ? "text-up" : "text-down"
                    }`}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                      <path
                        d={d === "UP" ? "M5 0L10 9H0z" : "M5 10L0 1h10z"}
                        fill="currentColor"
                      />
                    </svg>
                    {d === "UP" ? t.up : t.down}
                  </span>
                  <span className="t-figure mt-2 block text-[30px] text-text">
                    {q ? (
                      <LivePercent value={q.price} />
                    ) : bookLoading ? (
                      "…"
                    ) : (
                      <span className="text-[15px] text-faint">{t.priceUnavailable}</span>
                    )}
                  </span>
                </motion.button>
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

        <dl className="tint-gold flex items-end gap-8 rounded-2xl border border-gold/20 bg-surface-2 px-4 py-4">
          <div>
            <dt className="t-label">{t.youRisk}</dt>
            <dd className="t-figure mt-1.5 text-[22px] text-text">{money(stake, locale)}</dd>
          </div>
          <div>
            <dt className="t-label">{t.youWinIfRight}</dt>
            <dd className="t-figure mt-1.5 text-[22px] text-up">
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
            <motion.button
              type="button"
              disabled={!ready || phase.k === "placing"}
              onClick={submit}
              whileTap={reduce || !ready ? undefined : { scale: 0.985 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className={`w-full rounded-xl px-4 py-4 text-[15px] font-semibold text-[#17110a] transition-colors disabled:opacity-40 ${
                ready ? "cta-live glow-gold bg-gold hover:bg-gold/90" : "bg-gold"
              }`}
            >
              {phase.k === "placing" ? t.placing : t.placeCall}
            </motion.button>
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
