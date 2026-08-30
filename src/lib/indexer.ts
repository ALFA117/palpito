/**
 * Read layer: the public Somnia markets indexer (Hasura GraphQL, no auth).
 *
 * Everything Palpito shows about a call — who made it, which way, for how much,
 * and whether the chain later agreed — comes from here. There is no database
 * behind the reputation layer on purpose: a record you can recompute from a
 * public endpoint is a record nobody can quietly edit, including us.
 *
 * Scales on this venue (tUSDC, 6dp): fillPrice and quantity are both raw 1e6,
 * so 327000 is a probability of 0.327 and 6000000 is six contracts.
 */

import { INDEXER_URL, DEFAULT_VENUE_ID, WINDOWS, ONE, OUTCOME_YES } from "./somnia";

type Json = Record<string, unknown>;

async function gql<T>(query: string, variables: Json = {}, revalidate = 10): Promise<T> {
  const res = await fetch(INDEXER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`indexer ${res.status} ${res.statusText}`);
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(`indexer: ${body.errors.map((e) => e.message).join("; ")}`);
  if (!body.data) throw new Error("indexer returned no data");
  return body.data;
}

// ─── Types ───────────────────────────────────────────────────────────────────

/** Direction of a call in human terms. UP = bought YES, DOWN = bought NO. */
export type Direction = "UP" | "DOWN";

export interface Market {
  marketId: string;
  asset: string;
  intervalSec: number;
  expiry: number;
  tradingStart: number;
  clobStatus: string;
  finalized: boolean;
  voided: boolean;
  winningOutcome: number | null;
  oracleQuestionId: string | null;
  lastPrice: number | null;
  tradeCount: number;
  volume: number;
  venueId: string;
}

export interface Call {
  id: string;
  wallet: string;
  direction: Direction;
  /** Implied probability the buyer paid, 0-1. */
  price: number;
  /** Contracts bought. */
  size: number;
  /** Collateral staked, in tUSDC. */
  stake: number;
  timestamp: number;
  txHash: string;
  /** True when this fill was created by two opposite buyers with no seller. */
  mintedPair: boolean;
  market: Market;
}

export type CallOutcome = "won" | "lost" | "void" | "pending";

export interface Standing {
  wallet: string;
  won: number;
  lost: number;
  void: number;
  pending: number;
  /** Wins over settled (non-void) calls, 0-1. Null when nothing has settled. */
  hitRate: number | null;
  staked: number;
  returned: number;
  /** returned - staked, in tUSDC, over settled calls only. */
  pnl: number;
}

// ─── Shaping ─────────────────────────────────────────────────────────────────

const MARKET_FIELDS = `
  marketId asset intervalSec expiry tradingStart clobStatus
  finalized voided winningOutcome oracleQuestionId
  lastPrice tradeCount cumulativeQuoteVolume venueId
`;

const FILL_FIELDS = `
  id taker takerSide fillPrice quantity quoteQuantity timestamp txHash kind
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function toMarket(m: any): Market {
  return {
    marketId: m.marketId,
    asset: m.asset,
    intervalSec: Number(m.intervalSec),
    expiry: Number(m.expiry),
    tradingStart: Number(m.tradingStart ?? 0),
    clobStatus: m.clobStatus,
    finalized: Boolean(m.finalized),
    voided: Boolean(m.voided),
    winningOutcome:
      m.winningOutcome === null || m.winningOutcome === undefined ? null : Number(m.winningOutcome),
    oracleQuestionId: m.oracleQuestionId ?? null,
    lastPrice: m.lastPrice == null ? null : Number(m.lastPrice) / ONE,
    tradeCount: Number(m.tradeCount ?? 0),
    volume: Number(m.cumulativeQuoteVolume ?? 0) / ONE,
    venueId: m.venueId,
  };
}

/** A call is a BUY. Selling back out of a position is an exit, not a claim. */
function toCall(f: any): Call | null {
  const side = String(f.takerSide ?? "");
  if (side !== "BUY_YES" && side !== "BUY_NO") return null;
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
    market: toMarket(f.market),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Venue resolution ────────────────────────────────────────────────────────

let venueCache: { id: string; at: number } | null = null;

/**
 * The venue the live markets actually sit on.
 *
 * The bot kit ships a VENUE_ID and warns that it moves — it changed three times
 * in the first week of August, and the testnet deployment hosts four venues side
 * by side in the indexer. So we verify rather than trust: if the default venue
 * has no live markets, whichever venue does wins. A stale hardcoded id renders
 * an empty app, and an empty app looks exactly like an outage.
 */
export async function resolveVenueId(): Promise<string> {
  if (venueCache && Date.now() - venueCache.at < 5 * 60_000) return venueCache.id;

  // Counted over genuinely live markets, on the clock — see liveMarkets() for
  // why `clobStatus` cannot be used here either. Counting zombie rows would
  // rank venues by how much history they carry rather than by where the action
  // currently is, and those are not the same venue after a migration.
  const now = Math.floor(Date.now() / 1000);
  const data = await gql<{ Market: { venueId: string }[] }>(
    `query Venues($now: numeric!) {
       Market(
         where: {
           marketType: { _eq: "BINARY" }
           expiry: { _gt: $now }
           tradingStart: { _lte: $now }
           finalized: { _eq: false }
           voided: { _eq: false }
         }
       ) { venueId }
     }`,
    { now },
    60,
  );
  const counts = new Map<string, number>();
  for (const row of data.Market) counts.set(row.venueId, (counts.get(row.venueId) ?? 0) + 1);

  const id =
    (counts.get(DEFAULT_VENUE_ID) ?? 0) > 0
      ? DEFAULT_VENUE_ID
      : ([...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? DEFAULT_VENUE_ID);

  venueCache = { id, at: Date.now() };
  return id;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Live markets on our venue, real windows only, soonest to expire first.
 *
 * Liveness is derived from the clock, NOT from `clobStatus`. That column is a
 * trap: on this deployment it still reads "Trading" for markets whose window
 * closed weeks ago, so a status filter returns a wall of zombies and sorts the
 * genuinely live ones off the end of the page. Status on-chain is time-derived
 * anyway — expiry in the future, trading already started, not yet settled — so
 * that is what we ask for.
 */
export async function liveMarkets(): Promise<Market[]> {
  const venueId = await resolveVenueId();
  const now = Math.floor(Date.now() / 1000);
  const data = await gql<{ Market: unknown[] }>(
    `query Live($venueId: String!, $windows: [numeric!], $now: numeric!) {
       Market(
         where: {
           marketType: { _eq: "BINARY" }
           venueId: { _eq: $venueId }
           intervalSec: { _in: $windows }
           expiry: { _gt: $now }
           tradingStart: { _lte: $now }
           finalized: { _eq: false }
           voided: { _eq: false }
         }
         order_by: { expiry: asc }
         limit: 40
       ) { ${MARKET_FIELDS} }
     }`,
    { venueId, windows: WINDOWS, now },
    10,
  );
  return data.Market.map(toMarket);
}

/** Recent calls across the venue — the feed. */
export async function recentCalls(limit = 40): Promise<Call[]> {
  const venueId = await resolveVenueId();
  const data = await gql<{ Fill: unknown[] }>(
    `query Recent($venueId: String!, $windows: [numeric!], $limit: Int!) {
       Fill(
         where: {
           market: {
             marketType: { _eq: "BINARY" }
             venueId: { _eq: $venueId }
             intervalSec: { _in: $windows }
           }
           takerSide: { _in: ["BUY_YES", "BUY_NO"] }
         }
         order_by: { timestamp: desc }
         limit: $limit
       ) { ${FILL_FIELDS} market { ${MARKET_FIELDS} } }
     }`,
    { venueId, windows: WINDOWS, limit },
    10,
  );
  return data.Fill.map(toCall).filter((c): c is Call => c !== null);
}

/** Every call a wallet has ever made on this venue. */
export async function callsByWallet(wallet: string, limit = 200): Promise<Call[]> {
  const venueId = await resolveVenueId();
  const data = await gql<{ Fill: unknown[] }>(
    `query Wallet($venueId: String!, $wallet: String!, $limit: Int!) {
       Fill(
         where: {
           market: { marketType: { _eq: "BINARY" }, venueId: { _eq: $venueId } }
           taker: { _eq: $wallet }
           takerSide: { _in: ["BUY_YES", "BUY_NO"] }
         }
         order_by: { timestamp: desc }
         limit: $limit
       ) { ${FILL_FIELDS} market { ${MARKET_FIELDS} } }
     }`,
    { venueId, wallet: wallet.toLowerCase(), limit },
    15,
  );
  return data.Fill.map(toCall).filter((c): c is Call => c !== null);
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Did the chain agree with this call?
 *
 * A market only has a verdict once it is finalized. Voided markets pay both
 * sides 0.5 and carry no winning outcome, so they sit outside the hit rate
 * rather than counting as losses — the caller was never actually wrong.
 */
export function outcomeOf(call: Call): CallOutcome {
  const m = call.market;
  if (m.voided) return "void";
  if (!m.finalized || m.winningOutcome === null) return "pending";
  const upWon = m.winningOutcome === OUTCOME_YES;
  return (call.direction === "UP") === upWon ? "won" : "lost";
}

/** What this call paid back, in tUSDC. Winners redeem 1 per contract; a void pays 0.5. */
export function payoutOf(call: Call): number {
  switch (outcomeOf(call)) {
    case "won":
      return call.size;
    case "void":
      return call.size * 0.5;
    default:
      return 0;
  }
}

export function buildStanding(wallet: string, calls: Call[]): Standing {
  const s: Standing = {
    wallet: wallet.toLowerCase(),
    won: 0,
    lost: 0,
    void: 0,
    pending: 0,
    hitRate: null,
    staked: 0,
    returned: 0,
    pnl: 0,
  };
  for (const c of calls) {
    const o = outcomeOf(c);
    s[o] += 1;
    if (o === "pending") continue;
    s.staked += c.stake;
    s.returned += payoutOf(c);
  }
  const settled = s.won + s.lost;
  s.hitRate = settled > 0 ? s.won / settled : null;
  s.pnl = s.returned - s.staked;
  return s;
}

/** Top callers by hit rate, over wallets with enough settled calls to mean something. */
export async function leaderboard(minSettled = 5, limit = 10): Promise<Standing[]> {
  const venueId = await resolveVenueId();
  const data = await gql<{ Fill: unknown[] }>(
    `query Board($venueId: String!) {
       Fill(
         where: {
           market: {
             marketType: { _eq: "BINARY" }
             venueId: { _eq: $venueId }
             finalized: { _eq: true }
           }
           takerSide: { _in: ["BUY_YES", "BUY_NO"] }
         }
         order_by: { timestamp: desc }
         limit: 2000
       ) { ${FILL_FIELDS} market { ${MARKET_FIELDS} } }
     }`,
    { venueId },
    60,
  );
  const calls = data.Fill.map(toCall).filter((c): c is Call => c !== null);

  const byWallet = new Map<string, Call[]>();
  for (const c of calls) {
    const list = byWallet.get(c.wallet) ?? [];
    list.push(c);
    byWallet.set(c.wallet, list);
  }

  return [...byWallet.entries()]
    .map(([w, cs]) => buildStanding(w, cs))
    .filter((s) => s.won + s.lost >= minSettled)
    .sort((a, b) => (b.hitRate ?? 0) - (a.hitRate ?? 0) || b.pnl - a.pnl)
    .slice(0, limit);
}
