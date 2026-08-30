"use client";

/**
 * The one indexer read that happens in the browser rather than on the server.
 *
 * Everything else goes through `lib/indexer.ts`, whose `fetch` carries Next's
 * `revalidate` and is therefore server-only. The live section needs a shorter
 * cycle than a page revalidate can give, so it asks directly.
 */

import { INDEXER_URL, DEFAULT_VENUE_ID, WINDOWS, ONE } from "./somnia";
import type { Call, Market } from "./indexer";

/* eslint-disable @typescript-eslint/no-explicit-any */
function toCall(f: any): Call | null {
  const side = String(f.takerSide ?? "");
  if (side !== "BUY_YES" && side !== "BUY_NO") return null;
  const m = f.market;
  const market: Market = {
    marketId: m.marketId,
    asset: m.asset,
    intervalSec: Number(m.intervalSec),
    expiry: Number(m.expiry),
    tradingStart: Number(m.tradingStart ?? 0),
    clobStatus: m.clobStatus,
    finalized: Boolean(m.finalized),
    voided: Boolean(m.voided),
    winningOutcome: m.winningOutcome == null ? null : Number(m.winningOutcome),
    oracleQuestionId: m.oracleQuestionId ?? null,
    lastPrice: m.lastPrice == null ? null : Number(m.lastPrice) / ONE,
    tradeCount: Number(m.tradeCount ?? 0),
    volume: Number(m.cumulativeQuoteVolume ?? 0) / ONE,
    venueId: m.venueId,
    poolAddress: m.poolAddress ?? null,
  };
  return {
    id: f.id,
    wallet: String(f.taker).toLowerCase(),
    direction: side === "BUY_YES" ? "UP" : "DOWN",
    price: Number(f.fillPrice) / ONE,
    size: Number(f.quantity) / ONE,
    stake: Number(f.quoteQuantity) / ONE,
    timestamp: Number(f.timestamp),
    txHash: f.txHash,
    mintedPair: f.kind === "MINT_A_PAIR",
    market,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** The newest calls on the venue, optionally narrowed to one asset. */
export async function recentCallsClient(
  limit = 12,
  asset: string | null = null,
): Promise<Call[]> {
  const res = await fetch(INDEXER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query Live($venueId: String!, $windows: [numeric!], $limit: Int!) {
        Fill(
          where: {
            market: {
              marketType: { _eq: "BINARY" }
              venueId: { _eq: $venueId }
              intervalSec: { _in: $windows }
              strike: { _eq: "0" }
            }
            takerSide: { _in: ["BUY_YES", "BUY_NO"] }
          }
          order_by: { timestamp: desc }
          limit: $limit
        ) {
          id taker takerSide fillPrice quantity quoteQuantity timestamp txHash kind
          market {
            marketId asset intervalSec expiry tradingStart clobStatus
            finalized voided winningOutcome oracleQuestionId
            lastPrice tradeCount cumulativeQuoteVolume venueId poolAddress
          }
        }
      }`,
      // The venue is resolved server-side and rarely moves; the default is the
      // right answer here, and a wrong one only costs this section, not the page.
      variables: { venueId: DEFAULT_VENUE_ID, windows: WINDOWS, limit },
    }),
  });

  if (!res.ok) throw new Error(`indexer ${res.status}`);
  const body = (await res.json()) as { data?: { Fill: unknown[] }; errors?: unknown[] };
  if (body.errors?.length || !body.data) throw new Error("indexer error");

  const calls = body.data.Fill.map(toCall).filter((c): c is Call => c !== null);
  return asset ? calls.filter((c) => c.market.asset === asset) : calls;
}
