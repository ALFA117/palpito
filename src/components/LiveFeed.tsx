"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveFills, useIsTailing } from "@somnia-chain/markets-sdk/react";
import type { Call, Market } from "@/lib/indexer";
import { ONE } from "@/lib/somnia";
import { CallCard } from "./CallCard";
import { useLocale } from "./LocaleProvider";

/**
 * Calls arriving as they happen.
 *
 * The server-rendered feed revalidates every ten seconds, which is fine for
 * history and wrong for the thing this product is about: on a five-minute window
 * ten seconds is a meaningful share of the whole decision. The SDK tails the
 * chain directly, so a call can land on screen while the person who made it is
 * still looking at their wallet.
 *
 * `useLiveFills` watches one pool, so there is one watcher per live window. They
 * share a single socket and are ref-counted by the SDK, which is why this is a
 * component per pool rather than a loop — hooks cannot be called in one.
 */
function PoolTail({
  market,
  onCall,
}: {
  market: Market;
  onCall: (call: Call) => void;
}) {
  const fills = useLiveFills(market.poolAddress ?? undefined, 8);

  useEffect(() => {
    for (const f of fills) {
      // Taker identity is unresolved when OrderFilled is emitted — the taker's
      // own OrderPlaced fires later in the same transaction — so a fill can
      // arrive with no author. Showing it then would put an anonymous card in a
      // feed whose entire subject is who said what. Wait for the join.
      if (!f.taker || !f.takerSide) continue;
      if (f.takerSide !== "BUY_YES" && f.takerSide !== "BUY_NO") continue;

      onCall({
        id: f.id,
        wallet: String(f.taker).toLowerCase(),
        direction: f.takerSide === "BUY_YES" ? "UP" : "DOWN",
        price: Number(f.fillPrice) / ONE,
        size: Number(f.quantity) / ONE,
        stake: Number(f.quoteQuantity) / ONE,
        // Live fills carry no indexer timestamp; arrival is the truth here.
        timestamp: Math.floor(Date.now() / 1000),
        txHash: f.txHash ?? "",
        mintedPair: f.kind === "MINT_A_PAIR",
        market,
      });
    }
  }, [fills, market, onCall]);

  return null;
}

export function LiveFeed({
  markets,
  knownIds,
}: {
  markets: Market[];
  /** Ids already rendered by the server feed, so nothing appears twice. */
  knownIds: string[];
}) {
  const { t } = useLocale();
  const tailing = useIsTailing();
  const [fresh, setFresh] = useState<Call[]>([]);

  const known = useMemo(() => new Set(knownIds), [knownIds]);

  const onCall = useCallback(
    (call: Call) => {
      if (known.has(call.id)) return;
      setFresh((prev) =>
        prev.some((c) => c.id === call.id) ? prev : [call, ...prev].slice(0, 12),
      );
    },
    [known],
  );

  // A server refresh folds these into the main list, so anything it now covers is
  // filtered at render rather than synced out of state in an effect — the same
  // call must never sit in both places, and deriving it needs no extra render.
  const visible = fresh.filter((c) => !known.has(c.id));

  const pools = useMemo(
    () => markets.filter((m) => m.poolAddress),
    [markets],
  );

  return (
    <>
      {pools.map((m) => (
        <PoolTail key={m.marketId} market={m} onCall={onCall} />
      ))}

      {tailing && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-faint">
          <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-up" />
          {t.tailing}
        </p>
      )}

      {visible.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {visible.map((call) => (
            <div key={call.id} className="rounded-xl ring-1 ring-gold/30">
              <CallCard call={call} outcome="pending" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
