import { WINDOW_LABEL } from "./somnia";
import type { Locale } from "./i18n";

/**
 * Current unix seconds.
 *
 * Lives here rather than being read inline in a page because reading the clock
 * is a side effect, not rendering: pages take one timestamp alongside their data
 * and pass it down as part of the snapshot.
 */
export const nowSeconds = () => Math.floor(Date.now() / 1000);

export const shortAddress = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

/**
 * A stable, pronounceable handle for a wallet.
 *
 * Wallets in the feed belong to people who never signed up, so there is no
 * display name to read. A deterministic handle keyed off the address keeps the
 * feed human without inventing an identity that could be mistaken for a claimed
 * one — the address stays visible underneath.
 */
const ANIMALS = [
  "zorro", "cuervo", "lince", "puma", "halcon", "tejon", "nutria", "colibri",
  "jaguar", "buho", "lobo", "garza", "tapir", "quetzal", "coyote", "condor",
];

/**
 * Four hex characters of suffix, not three: at three, two wallets sharing an
 * animal collide roughly once every 4096 pairs, common enough on a leaderboard
 * to have shown up while testing. Collisions cannot be eliminated this way —
 * only made rare enough that the address underneath, always shown alongside
 * this handle, is the disambiguator rather than the norm.
 */
export function handleFor(address: string): string {
  const a = address.toLowerCase();
  const idx = parseInt(a.slice(2, 6), 16) % ANIMALS.length;
  return `${ANIMALS[idx]}${a.slice(-4)}`;
}

export const windowLabel = (sec: number) => WINDOW_LABEL[sec] ?? `${Math.round(sec / 60)}m`;

/** "420ms", "1.8s" — Somnia's own latency claim, measured rather than quoted. */
export const formatLatency = (ms: number) => (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`);

/** Probability as a percentage, e.g. 0.327 -> "33%". */
export const asPercent = (p: number) => `${Math.round(p * 100)}%`;

export function money(n: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function signedMoney(n: number, locale: Locale) {
  const s = money(Math.abs(n), locale);
  return n >= 0 ? `+${s}` : `-${s}`;
}

/** Compact countdown: "4h 12m", "12m 30s", "0s" once past. */
export function countdown(secondsLeft: number): string {
  const s = Math.max(0, Math.floor(secondsLeft));
  if (s === 0) return "0s";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/**
 * "hace 3 min" / "3 min ago", relative to an explicit `now`.
 *
 * The reference point is a parameter rather than `Date.now()` so the server and
 * the first client render agree — otherwise every card in the feed is a
 * hydration mismatch waiting for a slow network.
 */
export function timeAgo(unix: number, locale: Locale, now: number): string {
  const rtf = new Intl.RelativeTimeFormat(locale === "es" ? "es" : "en", { numeric: "auto" });
  const diff = unix - now;
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}
