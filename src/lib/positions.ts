/**
 * Open positions: what a wallet is still holding in windows that have not closed.
 *
 * Sourced from the indexer's `OutcomeBalance` rows, which cross-checked exactly
 * against the chain on every position tested. That is a listing read, though —
 * the SDK's own docs call the indexed balances "display-grade" — so the sell
 * path sizes itself from the on-chain balance rather than from this.
 */

import { INDEXER_URL, ONE, OUTCOME_YES } from "./somnia";
import type { Direction, Market } from "./indexer";

export interface Position {
  id: string;
  direction: Direction;
  /** Contracts held. */
  size: number;
  market: Market;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toPosition(row: any): Position {
  const m = row.market;
  return {
    id: row.id,
    direction: Number(row.outcomeIndex) === OUTCOME_YES ? "UP" : "DOWN",
    size: Number(row.balance) / ONE,
    market: {
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
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Everything the wallet still holds in a window that is open right now.
 *
 * Liveness is on the clock, as everywhere else — `clobStatus` reads "Trading"
 * on markets that closed weeks ago, so a status filter here would offer a Sell
 * button on a position that settled in July.
 */
export async function openPositions(wallet: string): Promise<Position[]> {
  const now = Math.floor(Date.now() / 1000);

  const res = await fetch(INDEXER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query Open($wallet: String!, $now: numeric!) {
        OutcomeBalance(
          where: {
            account: { _eq: $wallet }
            balance: { _gt: "0" }
            market: {
              marketType: { _eq: "BINARY" }
              strike: { _eq: "0" }
              expiry: { _gt: $now }
              tradingStart: { _lte: $now }
              finalized: { _eq: false }
              voided: { _eq: false }
            }
          }
          limit: 30
        ) {
          id balance outcomeIndex
          market {
            marketId asset intervalSec expiry tradingStart clobStatus
            finalized voided winningOutcome oracleQuestionId
            lastPrice tradeCount cumulativeQuoteVolume venueId poolAddress
          }
        }
      }`,
      variables: { wallet: wallet.toLowerCase(), now },
    }),
  });

  if (!res.ok) throw new Error(`indexer ${res.status}`);
  const body = (await res.json()) as { data?: { OutcomeBalance: unknown[] }; errors?: unknown[] };
  if (body.errors?.length || !body.data) throw new Error("indexer error");

  return body.data.OutcomeBalance.map(toPosition).sort((a, b) => a.market.expiry - b.market.expiry);
}
