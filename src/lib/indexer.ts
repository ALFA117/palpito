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

/** Network hiccups worth one quiet retry; anything else fails immediately. */
function isTransient(err: unknown): boolean {
  if (err instanceof TypeError) return true; // fetch's own network-failure shape
  const status = err instanceof Error ? Number(err.message.match(/^indexer (\d+)/)?.[1]) : NaN;
  return status >= 500;
}

async function gql<T>(query: string, variables: Json = {}, revalidate = 10): Promise<T> {
  const run = async () => {
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
  };

  try {
    return await run();
  } catch (err) {
    // One retry, for a third-party endpoint we do not control: a 5xx or a
    // dropped connection is usually gone within a second, and turning that
    // into a blank page is a worse failure than a 300ms delay.
    if (!isTransient(err)) throw err;
    await new Promise((r) => setTimeout(r, 300));
    return run();
  }
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
  /** The pool hosting this market's book. Recycled across windows — read it per market, never cache it. */
  poolAddress: string | null;
  /**
   * Every price this window has traded at, oldest first, 0-1.
   *
   * Real fills, not a synthesised curve — a freshly rolled window genuinely has
   * none, and the interface says so rather than drawing a flat line that looks
   * like data.
   */
  spark: number[];
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
  /**
   * The indexer's own name for how this fill crossed — `MINT_A_PAIR` is the
   * one we know and give a translated explanation to; anything else is shown
   * verbatim rather than guessed at. The venue is documented as having four
   * distinct crossing paths and this only confirms one of them by name.
   */
  kind: string;
  market: Market;
}

export type CallOutcome = "won" | "lost" | "void" | "pending";

/**
 * One confidence band: what they paid, versus how often they were right.
 *
 * The price a buyer pays IS their stated confidence — 0.70 for UP is "I think
 * this is 70% likely". So a band compares a claim against an outcome, which is
 * a stronger statement about someone than a hit rate: being right 60% of the
 * time is one number, being right 60% of the time WHEN YOU SAID 60% is the
 * number that identifies a forecaster rather than someone on a hot streak.
 */
export interface CalibrationBand {
  /** Lower edge of the band, 0-1. */
  from: number;
  to: number;
  /** Settled calls in this band. */
  n: number;
  /** Share of them that won, 0-1. */
  actual: number;
  /** Mean price paid inside the band — what they actually claimed. */
  claimed: number;
}

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
  /**
   * Consecutive wins (positive) or losses (negative) counting back from the most
   * recent settled call. Zero when nothing has settled.
   */
  streak: number;
  /** Confidence bands with enough calls to mean anything. Empty for a light record. */
  calibration: CalibrationBand[];
}

// ─── Shaping ─────────────────────────────────────────────────────────────────

const MARKET_FIELDS = `
  marketId asset intervalSec expiry tradingStart clobStatus
  finalized voided winningOutcome oracleQuestionId
  lastPrice tradeCount cumulativeQuoteVolume venueId poolAddress strike
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
    poolAddress: m.poolAddress ?? null,
    spark: Array.isArray(m.fills)
      ? m.fills.map((f: { fillPrice: string }) => Number(f.fillPrice) / ONE)
      : [],
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
    kind: String(f.kind ?? ""),
    market: toMarket(f.market),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Venue resolution ────────────────────────────────────────────────────────

/**
 * The venue the live markets actually sit on.
 *
 * The bot kit ships a VENUE_ID and warns that it moves — it changed three times
 * in the first week of August, and the testnet deployment hosts four venues side
 * by side in the indexer. So we verify rather than trust: if the default venue
 * has no live markets, whichever venue does wins. A stale hardcoded id renders
 * an empty app, and an empty app looks exactly like an outage.
 *
 * No module-level cache here on purpose: this runs in serverless, where a plain
 * variable resets on every cold start and gives back nothing for the complexity
 * it adds. `gql`'s own `revalidate: 60` already caches the query itself through
 * Next's data cache, which — unlike a module variable — survives across
 * invocations in production.
 */
export async function resolveVenueId(): Promise<string> {
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

  return (counts.get(DEFAULT_VENUE_ID) ?? 0) > 0
    ? DEFAULT_VENUE_ID
    : ([...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? DEFAULT_VENUE_ID);
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
           # Strike 0 means "closes at or above its opening price", which is what
           # the app's copy says. The venue also lists strike-based questions
           # ("will BTC be above $79,012"), and showing those under this wording
           # would describe the wrong bet.
           strike: { _eq: "0" }
           expiry: { _gt: $now }
           tradingStart: { _lte: $now }
           finalized: { _eq: false }
           voided: { _eq: false }
         }
         order_by: { expiry: asc }
         limit: 40
       ) {
         ${MARKET_FIELDS}
         fills(order_by: { timestamp: asc }, limit: 40) { fillPrice }
       }
     }`,
    { venueId, windows: WINDOWS, now },
    10,
  );
  return data.Market.map(toMarket);
}

// A cursor far enough out that "no cursor given" and "everything before this"
// are the same set. This indexer's Hasura config rejects an explicit `null`
// for a `numeric` variable outright — `{_lt: null}` is not "no filter" here,
// it is a thrown "unexpected null value for type 'numeric'" — so the no-cursor
// case sends a real, always-true value instead of trying to omit one.
const FAR_FUTURE = 9_999_999_999;

/**
 * Recent calls across the venue — the feed.
 *
 * `before` pages backward on `timestamp`, the same column the feed is sorted
 * by. An offset would do too, but it shifts under a feed that keeps getting
 * new fills at the head — page 2 by offset skips or repeats rows depending on
 * how much landed while you were reading page 1. A timestamp cursor cannot.
 */
export async function recentCalls(limit = 40, before?: number): Promise<Call[]> {
  const venueId = await resolveVenueId();
  const data = await gql<{ Fill: unknown[] }>(
    `query Recent($venueId: String!, $windows: [numeric!], $limit: Int!, $before: numeric!) {
       Fill(
         where: {
           market: {
             marketType: { _eq: "BINARY" }
             venueId: { _eq: $venueId }
             intervalSec: { _in: $windows }
             strike: { _eq: "0" }
           }
           takerSide: { _in: ["BUY_YES", "BUY_NO"] }
           timestamp: { _lt: $before }
         }
         order_by: { timestamp: desc }
         limit: $limit
       ) { ${FILL_FIELDS} market { ${MARKET_FIELDS} } }
     }`,
    { venueId, windows: WINDOWS, limit, before: before ?? FAR_FUTURE },
    before ? 0 : 10,
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

/** Band edges. Below 0.3 and above 0.8 are lumped: few people call those. */
const BANDS: [number, number][] = [
  [0, 0.3],
  [0.3, 0.45],
  [0.45, 0.55],
  [0.55, 0.7],
  [0.7, 1],
];

/** A band needs this many settled calls before its number means anything. */
const MIN_BAND = 4;

function calibrationOf(calls: Call[]): CalibrationBand[] {
  const settled = calls.filter((c) => {
    const o = outcomeOf(c);
    return o === "won" || o === "lost";
  });

  const bands: CalibrationBand[] = [];
  for (const [from, to] of BANDS) {
    const inBand = settled.filter((c) => c.price >= from && c.price < to);
    if (inBand.length < MIN_BAND) continue;
    const wins = inBand.filter((c) => outcomeOf(c) === "won").length;
    bands.push({
      from,
      to,
      n: inBand.length,
      actual: wins / inBand.length,
      claimed: inBand.reduce((n, c) => n + c.price, 0) / inBand.length,
    });
  }
  return bands;
}

/**
 * Wins or losses in a row, counting back from the newest settled call.
 *
 * Voids break nothing — the caller was never wrong — so they are skipped rather
 * than ending a streak.
 */
function streakOf(calls: Call[]): number {
  const settled = calls
    .map((c) => ({ c, o: outcomeOf(c) }))
    .filter((x) => x.o === "won" || x.o === "lost")
    .sort((a, b) => b.c.timestamp - a.c.timestamp);

  if (settled.length === 0) return 0;

  const winning = settled[0].o === "won";
  let n = 0;
  for (const x of settled) {
    if ((x.o === "won") !== winning) break;
    n += 1;
  }
  return winning ? n : -n;
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
    streak: 0,
    calibration: [],
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
  s.streak = streakOf(calls);
  s.calibration = calibrationOf(calls);
  return s;
}

/**
 * Fields the standings actually need.
 *
 * The full fill+market shape at 2000 rows is over 2MB, which silently exceeds
 * Next's data-cache ceiling — the response is then never cached and every
 * visitor pays for the whole scan. Scoring only needs the side, the size, and
 * the market's verdict.
 */
const STANDING_FIELDS = `
  taker takerSide quantity quoteQuantity timestamp
  market { winningOutcome voided finalized }
`;

/** How far back a leaderboard looks. */
export type BoardRange = "24h" | "7d" | "all";

export const BOARD_RANGES: BoardRange[] = ["24h", "7d", "all"];

const RANGE_SECONDS: Record<BoardRange, number | null> = {
  "24h": 86_400,
  "7d": 604_800,
  all: null,
};

/**
 * Top callers by hit rate, over wallets with enough settled calls to mean something.
 *
 * The range matters more than it looks. An all-time board on a venue this young
 * is a list of the handful of bots that have been running longest — true, and
 * completely static. A 24-hour board is the one that changes while you watch it,
 * which is the only version a feed has any use for.
 */
export async function leaderboard(
  range: BoardRange = "all",
  minSettled = 5,
  limit = 10,
): Promise<Standing[]> {
  const venueId = await resolveVenueId();
  const window = RANGE_SECONDS[range];
  const since = window === null ? 0 : Math.floor(Date.now() / 1000) - window;

  const data = await gql<{ Fill: unknown[] }>(
    `query Board($venueId: String!, $since: numeric!) {
       Fill(
         where: {
           market: {
             marketType: { _eq: "BINARY" }
             venueId: { _eq: $venueId }
             finalized: { _eq: true }
             strike: { _eq: "0" }
           }
           takerSide: { _in: ["BUY_YES", "BUY_NO"] }
           timestamp: { _gte: $since }
         }
         order_by: { timestamp: desc }
         limit: 2000
       ) { ${STANDING_FIELDS} }
     }`,
    { venueId, since },
    60,
  );

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const rows = data.Fill as any[];
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const byWallet = new Map<string, Standing>();

  for (const f of rows) {
    const side = String(f.takerSide ?? "");
    if (side !== "BUY_YES" && side !== "BUY_NO") continue;

    const wallet = String(f.taker).toLowerCase();
    const s =
      byWallet.get(wallet) ??
      {
        wallet, won: 0, lost: 0, void: 0, pending: 0,
        hitRate: null, staked: 0, returned: 0, pnl: 0,
        // The board's slim query carries neither price nor timestamp, so these
        // two stay empty here; the profile page computes them from full calls.
        streak: 0, calibration: [],
      };

    const m = f.market;
    const size = Number(f.quantity) / ONE;
    const stake = Number(f.quoteQuantity) / ONE;

    if (m.voided) {
      s.void += 1;
      s.staked += stake;
      s.returned += size * 0.5;
    } else if (m.finalized && m.winningOutcome !== null) {
      const upWon = Number(m.winningOutcome) === OUTCOME_YES;
      const won = (side === "BUY_YES") === upWon;
      if (won) {
        s.won += 1;
        s.returned += size;
      } else {
        s.lost += 1;
      }
      s.staked += stake;
    } else {
      s.pending += 1;
    }

    byWallet.set(wallet, s);
  }

  return [...byWallet.values()]
    .map((s) => {
      const settled = s.won + s.lost;
      return { ...s, hitRate: settled > 0 ? s.won / settled : null, pnl: s.returned - s.staked };
    })
    .filter((s) => s.won + s.lost >= minSettled)
    .sort((a, b) => (b.hitRate ?? 0) - (a.hitRate ?? 0) || b.pnl - a.pnl)
    .slice(0, limit);
}
