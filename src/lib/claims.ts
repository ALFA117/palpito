/**
 * Winnings that are sitting there unclaimed.
 *
 * A settled market pays out only when someone asks it to: the position does not
 * decay into collateral on its own. So a wallet that calls well for a week has
 * its money spread across finalised markets while its balance reads near zero,
 * and nothing in the interface ever says so. Checked against the live venue
 * while building this — real wallets, real unclaimed winnings.
 */

import { INDEXER_URL, ONE, OUTCOME_YES } from "./somnia";
import type { Direction } from "./indexer";

export interface Claim {
  id: string;
  marketId: string;
  asset: string;
  intervalSec: number;
  direction: Direction;
  /** Winning outcome index, as the redemption call wants it. */
  outcomeIdx: 0 | 1;
  /** Contracts held, raw units — what gets burned. */
  raw: bigint;
  /** What this pays out, in tUSDC. A void pays half; a win pays one per contract. */
  payout: number;
  voided: boolean;
  resolvedAt: number;
}

/**
 * Everything the wallet can redeem right now.
 *
 * Losing positions are excluded deliberately. Redeeming one succeeds and pays
 * zero — it does not revert — so including them would spend gas to burn worthless
 * tokens and make the claim look bigger than it is.
 */
export async function claimableWinnings(wallet: string): Promise<Claim[]> {
  const res = await fetch(INDEXER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query Claims($wallet: String!) {
        OutcomeBalance(
          where: {
            account: { _eq: $wallet }
            balance: { _gt: "0" }
            market: { marketType: { _eq: "BINARY" }, finalized: { _eq: true } }
          }
          limit: 60
        ) {
          id balance outcomeIndex
          market {
            marketId asset intervalSec winningOutcome voided resolvedAtTimestamp
          }
        }
      }`,
      variables: { wallet: wallet.toLowerCase() },
    }),
  });

  if (!res.ok) throw new Error(`indexer ${res.status}`);
  const body = (await res.json()) as {
    data?: { OutcomeBalance: unknown[] };
    errors?: unknown[];
  };
  if (body.errors?.length || !body.data) throw new Error("indexer error");

  const claims: Claim[] = [];

  for (const row of body.data.OutcomeBalance as Record<string, never>[]) {
    const r = row as unknown as {
      id: string;
      balance: string;
      outcomeIndex: number;
      market: {
        marketId: string;
        asset: string;
        intervalSec: string;
        winningOutcome: number | null;
        voided: boolean;
        resolvedAtTimestamp: string | null;
      };
    };
    const m = r.market;
    const held = Number(r.outcomeIndex) as 0 | 1;
    const contracts = Number(r.balance) / ONE;

    // A void has no winning outcome to compare against and pays both sides half.
    const won = m.voided ? true : m.winningOutcome !== null && Number(m.winningOutcome) === held;
    if (!won) continue;

    claims.push({
      id: r.id,
      marketId: m.marketId,
      asset: m.asset,
      intervalSec: Number(m.intervalSec),
      direction: held === OUTCOME_YES ? "UP" : "DOWN",
      outcomeIdx: held,
      raw: BigInt(r.balance),
      payout: m.voided ? contracts * 0.5 : contracts,
      voided: Boolean(m.voided),
      resolvedAt: Number(m.resolvedAtTimestamp ?? 0),
    });
  }

  return claims.sort((a, b) => b.resolvedAt - a.resolvedAt);
}

export const totalPayout = (claims: Claim[]) => claims.reduce((n, c) => n + c.payout, 0);
