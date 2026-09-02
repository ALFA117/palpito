#!/usr/bin/env node
/**
 * Captures a real, dated snapshot of the venue for demo continuity.
 *
 * Not a fallback for the app itself — the composer and the "live" ticker stay
 * on the real venue no matter what, because letting someone sign a real
 * transaction against a stale market here would fail on-chain (or worse,
 * mislead them into thinking it worked) in a way that is strictly worse than
 * an honest "no windows open right now". What this actually protects against
 * is narrower: a live demo landing in the gap between two windows, with
 * nothing to point at on screen while narrating what the feed normally shows.
 *
 * Plain constants duplicated from src/lib/somnia.ts on purpose — this runs
 * with plain `node`, outside the Next/TypeScript build, so it stays a
 * one-command fallback that still works if the app itself will not build.
 * If the venue moves again (it has, three times), update INDEXER_URL/
 * DEFAULT_VENUE_ID/WINDOWS here to match that file.
 */

import { writeFile } from "node:fs/promises";

const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";
const DEFAULT_VENUE_ID = "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c";
const WINDOWS = [300, 900, 3600, 14400, 86400];

async function gql(query, variables) {
  const res = await fetch(INDEXER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`indexer ${res.status} ${res.statusText}`);
  const body = await res.json();
  if (body.errors?.length) throw new Error(`indexer: ${body.errors.map((e) => e.message).join("; ")}`);
  return body.data;
}

async function resolveVenueId(now) {
  const data = await gql(
    `query($now: numeric!) {
       Market(where: { marketType: { _eq: "BINARY" }, expiry: { _gt: $now }, tradingStart: { _lte: $now }, finalized: { _eq: false }, voided: { _eq: false } }) { venueId }
     }`,
    { now },
  );
  const counts = new Map();
  for (const row of data.Market) counts.set(row.venueId, (counts.get(row.venueId) ?? 0) + 1);
  return (counts.get(DEFAULT_VENUE_ID) ?? 0) > 0
    ? DEFAULT_VENUE_ID
    : ([...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? DEFAULT_VENUE_ID);
}

const MARKET_FIELDS = `marketId asset intervalSec expiry tradingStart clobStatus finalized voided winningOutcome oracleQuestionId lastPrice tradeCount cumulativeQuoteVolume venueId poolAddress strike`;
const FILL_FIELDS = `id taker takerSide fillPrice quantity quoteQuantity timestamp txHash kind`;

async function main() {
  const now = Math.floor(Date.now() / 1000);
  const venueId = await resolveVenueId(now);

  const live = await gql(
    `query($venueId: String!, $windows: [numeric!], $now: numeric!) {
       Market(where: { marketType: { _eq: "BINARY" }, venueId: { _eq: $venueId }, intervalSec: { _in: $windows }, strike: { _eq: "0" }, expiry: { _gt: $now }, tradingStart: { _lte: $now }, finalized: { _eq: false }, voided: { _eq: false } }, order_by: { expiry: asc }, limit: 40) {
         ${MARKET_FIELDS}
         fills(order_by: { timestamp: asc }, limit: 40) { fillPrice }
       }
     }`,
    { venueId, windows: WINDOWS, now },
  );

  const recent = await gql(
    `query($venueId: String!, $windows: [numeric!]) {
       Fill(where: { market: { marketType: { _eq: "BINARY" }, venueId: { _eq: $venueId }, intervalSec: { _in: $windows }, strike: { _eq: "0" } }, takerSide: { _in: ["BUY_YES", "BUY_NO"] } }, order_by: { timestamp: desc }, limit: 40) {
         ${FILL_FIELDS} market { ${MARKET_FIELDS} }
       }
     }`,
    { venueId, windows: WINDOWS },
  );

  const snapshot = {
    capturedAt: new Date().toISOString(),
    venueId,
    note:
      "Backup only, for a live demo landing between windows. Real data, one real moment in time — not fabricated, and not live. If you are reading this during a demo: say so.",
    liveMarketsCount: live.Market.length,
    markets: live.Market,
    recentCalls: recent.Fill,
  };

  await writeFile(
    new URL("../docs/demo-snapshot.json", import.meta.url),
    JSON.stringify(snapshot, null, 2) + "\n",
  );

  console.log(
    `Wrote docs/demo-snapshot.json — ${live.Market.length} live markets, ${recent.Fill.length} recent calls, captured ${snapshot.capturedAt}.`,
  );
  if (live.Market.length === 0) {
    console.warn("Venue has zero live windows right now — this snapshot has none either.");
  }
}

main().catch((err) => {
  console.error("snapshot failed:", err);
  process.exitCode = 1;
});
