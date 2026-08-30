/**
 * Turn a sentence into a call on a live window.
 *
 * This is the deterministic half. The domain is genuinely small — two assets,
 * two directions, five windows — so most of what people actually type resolves
 * from patterns, instantly and offline. That matters twice over: the app works
 * with no API key (anyone can clone and run it), and the common path never waits
 * on a network round-trip. Anything this cannot read confidently is handed to
 * Claude in `/api/parse`, which is also where "there is no market for that"
 * gets explained properly.
 */

import type { Direction } from "./indexer";

export type Asset = "BTC" | "ETH";

export interface Hunch {
  asset: Asset | null;
  direction: Direction | null;
  /** Requested window, snapped to one the venue actually runs. */
  windowSec: number | null;
  /** Stake in tUSDC, when the sentence names one. */
  stake: number | null;
}

/** A hunch is actionable once we know what and which way; the rest has defaults. */
export const isActionable = (h: Hunch) => h.asset !== null && h.direction !== null;

const ASSET_PATTERNS: [RegExp, Asset][] = [
  [/\b(bitcoin|bitcoins|btc|xbt)\b/i, "BTC"],
  [/\b(ethereum|ether|eth)\b/i, "ETH"],
];

/**
 * Direction words in both languages.
 *
 * Whole-word patterns, not substrings: "bajista" contains "baja", but so does
 * "trabaja", and a feed that reads "trabaja" as a bearish call is worse than one
 * that reads nothing.
 *
 * Deliberately missing: gana/ganar and pierde/perder. They are the dominant
 * verbs in Spanish sports talk, so "ganará el América el domingo" parsed as a
 * bullish call — and sports is exactly the request this venue cannot serve and
 * must decline cleanly. They buy almost nothing back: nobody says "el bitcoin
 * gana" when they mean it closes up.
 */
const UP_PATTERNS = [
  /\b(sube|subir[áa]?|subiendo|suba)\b/i,
  /\b(arriba|alza|alcista|verde)\b/i,
  /\b(crece|crecer|repunta|repuntar)\b/i,
  /\b(up|rise|rises|rising|higher|above|climb|climbs|pump|bull|bullish|moon)\b/i,
  /\b(green|gains?)\b/i,
];

const DOWN_PATTERNS = [
  /\b(baja|bajar[áa]?|bajando|caer[áa]?|cae|cayendo|desploma)\b/i,
  /\b(abajo|ca[íi]da|bajista|rojo)\b/i,
  /\b(hunde|hundir|desplomar)\b/i,
  /\b(down|fall|falls|falling|lower|below|drop|drops|dump|bear|bearish|crash)\b/i,
  /\b(red|loses?|losses)\b/i,
];

/**
 * Negations that flip the read.
 *
 * "no creo que suba" is a DOWN call written with an UP word, and it is a normal
 * way to say it in both languages. Only the plain forms are handled — anything
 * knottier is exactly what the model fallback is for.
 */
const NEGATIONS = [
  /\bno\s+(creo|pienso|veo|espero)\b/i,
  /\bdon'?t\s+think\b/i,
  /\bdo\s+not\s+think\b/i,
  /\bno\s+(va\s+a|vaya\s+a)\b/i,
  /\bwon'?t\b/i,
  /\bnot\s+going\s+to\b/i,
];

/** Duration phrases → seconds. Ordered longest-first so "media hora" beats "hora". */
const DURATION_PATTERNS: [RegExp, number][] = [
  [/\b(media\s+hora|half\s+an?\s+hour)\b/i, 1800],
  [/\b(un\s+cuarto\s+de\s+hora|quarter\s+hour)\b/i, 900],
  [/\b(un\s+d[íi]a|24\s*h(oras?|rs?)?|today|hoy|ma[ñn]ana|tomorrow)\b/i, 86400],
  [/\b(una?\s+hora|1\s*h(ora|our|r)?|next\s+hour|pr[óo]xima\s+hora|esta\s+hora|this\s+hour)\b/i, 3600],
  [/\b(\d+)\s*(minutos?|mins?|m)\b/i, -1], // -1 = read the captured number
  [/\b(\d+)\s*(horas?|hours?|hrs?|h)\b/i, -2], // -2 = captured number, in hours
  // Vague immediacy — "in a bit", "ahorita". Resolves to the shortest window,
  // which is the only honest reading of "soon" on a venue whose next-shortest
  // option is a quarter of an hour away.
  [/\b(ahorita|ahora|ya\s+mismo|un\s+rato|right\s+now|in\s+a\s+bit|soon|pronto)\b/i, 300],
];

/** "$10", "10 dólares", "5 tusdc", "con 25". */
const STAKE_PATTERNS = [
  /\$\s*(\d+(?:[.,]\d+)?)/,
  /\b(\d+(?:[.,]\d+)?)\s*(tusdc|usdc|d[óo]lares?|dollars?|bucks?|pesos?)\b/i,
  /\b(?:con|apuesto|pongo|poner|stake|bet|with)\s+(\d+(?:[.,]\d+)?)\b/i,
];

function matchFirst<T>(text: string, patterns: [RegExp, T][]): T | null {
  for (const [re, value] of patterns) if (re.test(text)) return value;
  return null;
}

function readDuration(text: string): number | null {
  for (const [re, value] of DURATION_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    if (value === -1) return Number(m[1]) * 60;
    if (value === -2) return Number(m[1]) * 3600;
    return value;
  }
  return null;
}

function readStake(text: string): number | null {
  for (const re of STAKE_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const n = Number(m[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * Snap a requested duration onto a window the venue is actually running.
 *
 * "the next half hour" has no 30-minute market behind it, so it resolves to the
 * closest thing that exists. Closeness is measured on a log scale: from 1800s,
 * the 3600s window is a better answer than the 900s one even though both are
 * 900 seconds away, because being early is worse than being late — a 15-minute
 * window closes before the half hour the person was talking about.
 */
export function snapWindow(requestedSec: number, available: number[]): number | null {
  if (available.length === 0) return null;
  return available.reduce((best, w) => {
    const score = (x: number) => Math.abs(Math.log(x / requestedSec)) + (x < requestedSec ? 0.25 : 0);
    return score(w) < score(best) ? w : best;
  }, available[0]);
}

/**
 * Straighten typographic punctuation before matching.
 *
 * Phones and macOS autocorrect an apostrophe to U+2019, so a user typing
 * "I don't think btc rises" sends "don’t" — and `/don'?t/` reads that as a
 * plain "rises", inverting the call into the opposite of what they said. Getting
 * a direction backwards is the worst failure this parser has, so normalise
 * first rather than doubling every pattern.
 */
const straighten = (text: string) => text.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"');

export function parseHunch(input: string, availableWindows: number[] = []): Hunch {
  const text = straighten(input);
  const asset = matchFirst(text, ASSET_PATTERNS);

  const saysUp = UP_PATTERNS.some((re) => re.test(text));
  const saysDown = DOWN_PATTERNS.some((re) => re.test(text));
  const negated = NEGATIONS.some((re) => re.test(text));

  let direction: Direction | null = null;
  // Both directions named at once is ambiguous ("sube o baja?"), not a call.
  if (saysUp !== saysDown) {
    const raw: Direction = saysUp ? "UP" : "DOWN";
    direction = negated ? (raw === "UP" ? "DOWN" : "UP") : raw;
  }

  const requested = readDuration(text);
  const windowSec =
    requested !== null && availableWindows.length > 0
      ? snapWindow(requested, availableWindows)
      : null;

  return { asset, direction, windowSec, stake: readStake(text) };
}
