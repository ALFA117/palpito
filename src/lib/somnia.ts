/**
 * Somnia testnet + DreamDEX event-contract constants.
 *
 * Addresses are CREATE3-deterministic and identical on both networks; only the
 * collateral token and the venue's market creator differ. Verified against the
 * dreamdex-bot-kit deployment map and docs.dreamdex.io/developers/event-contracts.
 */

export const NETWORK = "testnet" as const;
export const CHAIN_ID = 50312;

export const RPC_URL = "https://api.infra.testnet.somnia.network";
export const WS_RPC_URL = "wss://api.infra.testnet.somnia.network/ws";
export const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";

/** Collateral on testnet is tUSDC — 6 decimals, with a public faucet. */
export const COLLATERAL_DECIMALS = 6;

/**
 * One unit of collateral in raw indexer units. Prices, sizes and stakes all
 * arrive scaled by this, so 327000 is a probability of 0.327 and 6000000 is six
 * contracts. A plain number, not a bigint: every read path divides into a float
 * for display, and the write path converts from human units through the SDK.
 */
export const ONE = 1_000_000;

export const ADDRESSES = {
  collateral: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
  binaryModule: "0x3ecC694Cef705358864a646142ac17A90E29e388",
  marketsCore: "0x2802504314685D89bF6C992CA5a8e7cC78bc0294",
  binarySettlement: "0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23",
  outcomeToken: "0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9",
  oracleHub: "0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b",
  collateralRouter: "0xbC0C9834B15ACE38bB50dDaa7d7f7C7CC4DC183C",
} as const;

/**
 * The venue our markets live on.
 *
 * Gotcha: this MOVES. The testnet deployment hosts four venues side by side in
 * the indexer and they changed three times in the first week of August. Never
 * treat this as permanent — `resolveVenueId()` in indexer.ts falls back to
 * whichever venue actually carries the live markets.
 */
export const DEFAULT_VENUE_ID =
  "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c";

/**
 * Window durations we surface. The venue also runs 3s/45s/60s test windows that
 * are noise for a human feed, so we allowlist the real ones rather than
 * excluding the junk — a new junk interval would otherwise leak straight in.
 */
export const WINDOWS = [300, 900, 3600, 14400, 86400] as const;

/**
 * Which markets mean "closes at or above its opening price" — the only bet the
 * app's copy describes.
 *
 * Until 2026-09-30 18:15 UTC our venue wrote that as `strike = 0`. From the
 * window that opened at 18:20 UTC (unix 1790792400) on, the same venue writes
 * the opening price itself into the strike ("Will BTC/USDC's price be at or
 * above 83957.015 at unix time …"), and has created no `strike = 0` market
 * since. Filtering on `strike = 0` alone therefore emptied the app from that
 * day. Verified against the indexer on 2026-11-07: every window opened at the
 * same moment shares one strike, and consecutive windows walk with the price.
 *
 * Older non-zero strikes on other venues are still excluded: before the switch
 * a strike could be an arbitrary level, which this wording would misdescribe.
 */
export const OPENING_STRIKE_SINCE = 1790792400;

/** Hasura condition, to drop inside any `Market` where-clause. */
export const OPENING_PRICE_MARKETS = `_or: [{ strike: { _eq: "0" } }, { tradingStart: { _gte: "${OPENING_STRIKE_SINCE}" } }]`;
export type WindowSec = (typeof WINDOWS)[number];

export const WINDOW_LABEL: Record<number, string> = {
  300: "5m",
  900: "15m",
  3600: "1h",
  14400: "4h",
  86400: "24h",
};

/** YES is outcome 0, NO is outcome 1 — the order the contracts use. */
export const OUTCOME_YES = 0;
export const OUTCOME_NO = 1;

/**
 * Prices on the oracle side are in cents: a market's `strike` and the oracle's
 * `numericValue` are both USD x 100 (strike 7594587 is the "75945.875" in the
 * question text, truncated). Checked on 2026-11-07 against 30 settled windows:
 * `numericValue >= strike` matched `winningOutcome = 0` on every one.
 *
 * There used to be a deep link to the oracle's explorer here. It pointed at
 * prd.oracle.somnia.host, which is the MAINNET oracle (chain 5031): old ids
 * opened unrelated questions there (a football match) and every id since the
 * 2026-09-30 switch is a 77-digit hash it answers "question not found". The
 * receipt now lives on the market page and links the settlement transaction on
 * the testnet explorer instead — something that always exists.
 */
export const ORACLE_PRICE_SCALE = 100;

export const explorerTxUrl = (hash: string) =>
  `https://shannon-explorer.somnia.network/tx/${hash}`;

export const explorerBlockUrl = (block: string | number) =>
  `https://shannon-explorer.somnia.network/block/${block}`;

export const explorerAddressUrl = (addr: string) =>
  `https://shannon-explorer.somnia.network/address/${addr}`;
