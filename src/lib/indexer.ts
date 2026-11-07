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

import {
  INDEXER_URL,
  DEFAULT_VENUE_ID,
  WINDOWS,
  ONE,
  OUTCOME_YES,
  OPENING_PRICE_MARKETS,
  ORACLE_PRICE_SCALE,
} from "./somnia";

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
  //
  // `now` is floored to the minute because it is part of the cache key: with
  // the exact second, every request was a new query and the `revalidate: 60`
  // below never served a single hit — a ~0.6s indexer round trip in front of
  // every page. A venue does not migrate within a minute.
  const now = Math.floor(Date.now() / 60_000) * 60;
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
           # Only "closes at or above its opening price", which is what the
           # app's copy says. See OPENING_PRICE_MARKETS for why this is not
           # simply strike = 0 any more.
           ${OPENING_PRICE_MARKETS}
           expiry: { _gt: $now }
           tradingStart: { _lte: $now }
           finalized: { _eq: false }
           voided: { _eq: false }
         }
         order_by: { expiry: asc }
         limit: 40
       ) {
         ${MARKET_FIELDS}
       }
     }`,
    { venueId, windows: WINDOWS, now },
    10,
  );

  // Sparkline prices come in ONE batched query instead of a nested `fills`
  // per market. Nested, each market cost ~1s on this indexer, so ten live
  // windows ran into its statement timeout ("database query error") and the
  // whole wall failed. Batched by market_id it answers in under a second.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const rows = data.Market as any[];
  if (rows.length > 0) {
    try {
      const spark = await gql<{ Fill: { market_id: string; fillPrice: string }[] }>(
        `query Spark($ids: [String!]) {
           Fill(where: { market_id: { _in: $ids } }, order_by: { timestamp: desc }, limit: 2000) {
             market_id fillPrice
           }
         }`,
        { ids: rows.map((m) => m.marketId) },
        10,
      );
      // Newest first so a busy window keeps its LATEST 40 prices (the line
      // should end where the price is now), then flipped back to oldest-first.
      const byMarket = new Map<string, { fillPrice: string }[]>();
      for (const f of spark.Fill) {
        const list = byMarket.get(f.market_id) ?? [];
        if (list.length < 40) list.push(f);
        byMarket.set(f.market_id, list);
      }
      for (const m of rows) m.fills = (byMarket.get(m.marketId) ?? []).reverse();
    } catch {
      // A missing sparkline is cosmetic; never let it take the wall down.
    }
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return rows.map(toMarket);
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
             ${OPENING_PRICE_MARKETS}
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

/** One market by id — the target of a deep link. Null when it does not exist. */
export async function marketById(marketId: string): Promise<Market | null> {
  const data = await gql<{ Market: unknown[] }>(
    `query OneMarket($marketId: String!) {
       Market(where: { marketId: { _eq: $marketId } }, limit: 1) {
         ${MARKET_FIELDS}
         fills(order_by: { timestamp: desc }, limit: 40) { fillPrice }
       }
     }`,
    { marketId },
    10,
  );
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const row = data.Market[0] as any;
  if (!row) return null;
  // The latest 40 prices, drawn oldest to newest.
  if (Array.isArray(row.fills)) row.fills = [...row.fills].reverse();
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return toMarket(row);
}

/**
 * What settled a window, read back from the chain's own records.
 *
 * This is the "see why" a card promises: the price line the window was opened
 * against, the price the oracle published at the close, and the transaction
 * that settled the market on the testnet explorer.
 */
export interface Receipt {
  /** The settlement transaction. Null when the indexer has no resolution row yet. */
  txHash: string | null;
  /** Block the market resolved in — a fallback link when the tx is missing. */
  block: string | null;
  /**
   * The line the close was compared with, in USD. Null for windows opened
   * before 2026-09-30, which compared against an opening price the market row
   * does not carry (they were written as strike 0).
   */
  line: number | null;
  /** The price the oracle published at the close, in USD. */
  close: number | null;
}

export async function marketReceipt(
  marketId: string,
  oracleQuestionId: string | null,
): Promise<Receipt> {
  const data = await gql<{
    MarketResolutionEvent: { txHash: string; blockNumber: string }[];
    OracleAnswer: { numericValue: string | null; voided: boolean }[];
    Market: { strike: string | null; resolvedAtBlock: string | null }[];
  }>(
    `query Receipt($marketId: String!, $questionId: numeric!) {
       MarketResolutionEvent(
         where: { market_id: { _eq: $marketId } }
         order_by: { blockNumber: desc }
         limit: 1
       ) { txHash blockNumber }
       OracleAnswer(where: { oracleQuestionId: { _eq: $questionId } }, limit: 1) {
         numericValue voided
       }
       Market(where: { marketId: { _eq: $marketId } }, limit: 1) { strike resolvedAtBlock }
     }`,
    // A 77-digit id does not survive a JSON number; Hasura reads numeric from a string.
    { marketId, questionId: oracleQuestionId ?? "0" },
    300,
  );

  const event = data.MarketResolutionEvent[0];
  const answer = oracleQuestionId ? data.OracleAnswer[0] : undefined;
  const market = data.Market[0];
  const strike = Number(market?.strike ?? 0);

  return {
    txHash: event?.txHash ?? null,
    block: event?.blockNumber ?? market?.resolvedAtBlock ?? null,
    line: strike > 0 ? strike / ORACLE_PRICE_SCALE : null,
    close:
      answer && !answer.voided && answer.numericValue != null
        ? Number(answer.numericValue) / ORACLE_PRICE_SCALE
        : null,
  };
}

/** Every call made on one market — the deep-linked page's own thread. */
export async function callsByMarket(marketId: string, limit = 40): Promise<Call[]> {
  const data = await gql<{ Fill: unknown[] }>(
    `query MarketCalls($marketId: String!, $limit: Int!) {
       Fill(
         where: {
           market: { marketId: { _eq: $marketId } }
           takerSide: { _in: ["BUY_YES", "BUY_NO"] }
         }
         order_by: { timestamp: desc }
         limit: $limit
       ) { ${FILL_FIELDS} market { ${MARKET_FIELDS} } }
     }`,
    { marketId, limit },
    10,
  );
  return data.Fill.map(toCall).filter((c): c is Call => c !== null);
}

/** One call by its fill id — the receipt a share card is built from. */
export async function callById(id: string): Promise<Call | null> {
  const data = await gql<{ Fill: unknown[] }>(
    `query OneFill($id: String!) {
       Fill(where: { id: { _eq: $id } }, limit: 1) { ${FILL_FIELDS} market { ${MARKET_FIELDS} } }
     }`,
    { id },
    30,
  );
  const row = data.Fill[0];
  return row ? toCall(row) : null;
}

/**
 * A wallet's latest calls on this venue, newest first, up to `limit`.
 *
 * Same set the wall and the board count — real windows, "closes at or above
 * its opening price" — so a profile and the leaderboard score the same calls.
 * Before, the profile also counted the venue's 60-second test windows, which
 * the wall drops as noise, and the two pages disagreed for the same wallet.
 *
 * It is NOT every call ever: an active bot has tens of thousands, and the
 * public indexer has no aggregates. The page says how far back it reaches
 * whenever the cap is hit.
 */
export async function callsByWallet(wallet: string, limit = 200): Promise<Call[]> {
  const venueId = await resolveVenueId();
  const data = await gql<{ Fill: unknown[] }>(
    `query Wallet($venueId: String!, $windows: [numeric!], $wallet: String!, $limit: Int!) {
       Fill(
         where: {
           market: {
             marketType: { _eq: "BINARY" }
             venueId: { _eq: $venueId }
             intervalSec: { _in: $windows }
             ${OPENING_PRICE_MARKETS}
           }
           taker: { _eq: $wallet }
           takerSide: { _in: ["BUY_YES", "BUY_NO"] }
         }
         order_by: { timestamp: desc }
         limit: $limit
       ) { ${FILL_FIELDS} market { ${MARKET_FIELDS} } }
     }`,
    { venueId, windows: WINDOWS, wallet: wallet.toLowerCase(), limit },
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

/**
 * How far back a leaderboard looks.
 *
 * There is no "all time": the venue has carried well over 60,000 settled
 * calls since July, the public indexer has no aggregates, and one board
 * request can only score a few thousand rows. An "all time" tab was really
 * "the latest 2,000 calls" (about five weeks), so it now says what it is.
 */
export type BoardRange = "24h" | "7d" | "30d";

export const BOARD_RANGES: BoardRange[] = ["24h", "7d", "30d"];

const RANGE_SECONDS: Record<BoardRange, number> = {
  "24h": 86_400,
  "7d": 604_800,
  "30d": 2_592_000,
};

/** Rows one board request scores. Slim rows, ~250 bytes each. */
const BOARD_SCAN = 2000;

export interface Board {
  standings: Standing[];
  /**
   * Set only when the scan hit BOARD_SCAN before the start of the range: the
   * timestamp of the oldest call that was counted, so the page can say the
   * board starts there rather than at the top of the range.
   */
  truncatedSince: number | null;
}

/**
 * Top callers by hit rate, over wallets with enough settled calls to mean something.
 *
 * The range matters more than it looks. An all-time board on a venue this young
 * is a list of the handful of bots that have been running longest — true, and
 * completely static. A 24-hour board is the one that changes while you watch it,
 * which is the only version a feed has any use for.
 */
export async function leaderboard(
  range: BoardRange = "24h",
  minSettled = 5,
  limit = 10,
): Promise<Board> {
  const venueId = await resolveVenueId();
  // Floored to the minute for the same reason as in resolveVenueId: the range
  // start is part of the cache key, and to the second it never repeats.
  const since = Math.floor(Date.now() / 60_000) * 60 - RANGE_SECONDS[range];

  const data = await gql<{ Fill: unknown[] }>(
    `query Board($venueId: String!, $windows: [numeric!], $since: numeric!, $scan: Int!) {
       Fill(
         where: {
           market: {
             marketType: { _eq: "BINARY" }
             venueId: { _eq: $venueId }
             finalized: { _eq: true }
             # The same windows the wall shows. The venue's 60-second test
             # series used to count here, and the top of the board was a bot
             # living in windows the wall drops as noise.
             intervalSec: { _in: $windows }
             ${OPENING_PRICE_MARKETS}
           }
           takerSide: { _in: ["BUY_YES", "BUY_NO"] }
           timestamp: { _gte: $since }
         }
         order_by: { timestamp: desc }
         limit: $scan
       ) { ${STANDING_FIELDS} }
     }`,
    { venueId, windows: WINDOWS, since, scan: BOARD_SCAN },
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

  const standings = [...byWallet.values()]
    .map((s) => {
      const settled = s.won + s.lost;
      return { ...s, hitRate: settled > 0 ? s.won / settled : null, pnl: s.returned - s.staked };
    })
    .filter((s) => s.won + s.lost >= minSettled)
    .sort((a, b) => (b.hitRate ?? 0) - (a.hitRate ?? 0) || b.pnl - a.pnl)
    .slice(0, limit);

  return {
    standings,
    truncatedSince:
      rows.length >= BOARD_SCAN ? Number(rows[rows.length - 1].timestamp) || null : null,
  };
}
