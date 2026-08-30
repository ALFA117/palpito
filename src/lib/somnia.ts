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

/** Deep link to the oracle's own resolution graph for a market's question. */
export const oracleGraphUrl = (oracleQuestionId: string) =>
  `https://prd.oracle.somnia.host/questions/${oracleQuestionId}?view=graph`;

export const explorerTxUrl = (hash: string) =>
  `https://shannon-explorer.somnia.network/tx/${hash}`;

export const explorerAddressUrl = (addr: string) =>
  `https://shannon-explorer.somnia.network/address/${addr}`;
