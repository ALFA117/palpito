/**
 * Bilingual copy, Spanish first.
 *
 * Spanish is the default rather than the translation: the ecosystem angle for
 * this build is Spanish-speaking users, so English is the fallback locale. Every
 * key must exist in both — the Dict type makes a missing one a compile error.
 */

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

const es = {
  // Shell
  appName: "Palpito",
  tagline: "Dilo. Que la cadena lo confirme.",
  navFeed: "Muro",
  navBoard: "Ranking",
  navMe: "Mi récord",
  connect: "Conectar",
  disconnect: "Salir",

  // Composer
  composerPlaceholder: "Escribe tu palpito. Ej: creo que el bitcoin cierra arriba en la próxima media hora",
  composerCta: "Convertir en palpito",
  composerThinking: "Buscando la ventana...",
  composerHint: "Lo pasamos a una ventana real que está abierta ahora mismo.",

  // Direction
  up: "Sube",
  down: "Baja",
  upLong: "cierra arriba de su precio de apertura",
  downLong: "cierra abajo de su precio de apertura",

  // Call card
  called: "dijo",
  staked: "puso",
  atOdds: "a",
  closesIn: "cierra en",
  closed: "cerrada",
  settling: "liquidando",
  joinCall: "Me sumo",
  fadeCall: "Voy en contra",
  madeLiquidity: "Este palpito creó liquidez",
  madeLiquidityWhy:
    "Dos personas apostaron en contra la una de la otra. El protocolo emitió el par: no hizo falta ningún market maker.",

  // Outcomes
  won: "Acertó",
  lost: "Falló",
  void: "Anulada",
  pending: "En juego",
  verify: "Ver por qué",
  verifyLong: "Ver la resolución del oráculo",
  receiptTitle: "Recibo verificable",
  receiptBody: "El oráculo publicó el resultado en cadena. Nadie lo puede editar, ni nosotros.",

  // Record
  hitRate: "Aciertos",
  calls: "palpitos",
  settledCalls: "resueltos",
  pnl: "Resultado",
  streak: "Racha",
  noRecordYet: "Todavía sin palpitos resueltos.",
  anyWallet: "Pega cualquier dirección y mira su récord real.",

  // Board
  boardTitle: "Quién acierta de verdad",
  boardSub: "Calculado desde la cadena, no desde capturas de pantalla.",
  boardMin: "mínimo 5 palpitos resueltos",

  // Feed
  feedTitle: "Lo que la gente está diciendo",
  feedEmpty: "Nadie ha dicho nada todavía en esta ventana.",
  liveNow: "en vivo",
  loadError: "No pudimos leer la cadena. Reintenta en un momento.",

  // Windows / assets
  window: "ventana",
  asset: "activo",

  // Onboarding
  whatIsThis: "¿Qué es esto?",
  whatIsThisBody:
    "Dices lo que crees que va a pasar con el precio de bitcoin o ethereum. Se convierte en una posición real que se liquida sola en minutos. Cuando cierra, queda escrito si tenías razón.",
  poweredBy: "Contratos de evento de DreamDEX sobre Somnia",
  testnetNotice: "Red de prueba. El dinero no es real.",
};

/**
 * Keys are pinned, values are not: `as const` on the Spanish source would make
 * every value its own literal type and reject the English translation of it.
 * A missing or misspelled key is still a compile error, which is the check
 * that actually matters.
 */
export type Dict = Record<keyof typeof es, string>;

const en: Dict = {
  appName: "Palpito",
  tagline: "Say it. Let the chain settle it.",
  navFeed: "Feed",
  navBoard: "Leaderboard",
  navMe: "My record",
  connect: "Connect",
  disconnect: "Sign out",

  composerPlaceholder: "Write your hunch. e.g. I think bitcoin closes up over the next half hour",
  composerCta: "Turn it into a call",
  composerThinking: "Finding the window...",
  composerHint: "We map it onto a real window that is open right now.",

  up: "Up",
  down: "Down",
  upLong: "closes above its opening price",
  downLong: "closes below its opening price",

  called: "called",
  staked: "staked",
  atOdds: "at",
  closesIn: "closes in",
  closed: "closed",
  settling: "settling",
  joinCall: "I'm in",
  fadeCall: "Fade it",
  madeLiquidity: "This call created liquidity",
  madeLiquidityWhy:
    "Two people bet against each other. The protocol minted the pair — no market maker was needed.",

  won: "Called it",
  lost: "Missed",
  void: "Voided",
  pending: "Live",
  verify: "See why",
  verifyLong: "See the oracle resolution",
  receiptTitle: "Verifiable receipt",
  receiptBody: "The oracle published this result on-chain. Nobody can edit it, including us.",

  hitRate: "Hit rate",
  calls: "calls",
  settledCalls: "settled",
  pnl: "Result",
  streak: "Streak",
  noRecordYet: "No settled calls yet.",
  anyWallet: "Paste any address and see its real record.",

  boardTitle: "Who is actually right",
  boardSub: "Computed from the chain, not from screenshots.",
  boardMin: "minimum 5 settled calls",

  feedTitle: "What people are calling",
  feedEmpty: "Nobody has called this window yet.",
  liveNow: "live",
  loadError: "We could not read the chain. Try again in a moment.",

  window: "window",
  asset: "asset",

  whatIsThis: "What is this?",
  whatIsThisBody:
    "You say what you think bitcoin or ethereum's price will do. It becomes a real position that settles itself in minutes. When it closes, whether you were right is written down.",
  poweredBy: "DreamDEX event contracts on Somnia",
  testnetNotice: "Testnet. The money is not real.",
};

export const DICTS: Record<Locale, Dict> = { es, en };

export function isLocale(v: string | undefined | null): v is Locale {
  return v === "es" || v === "en";
}

/** Pick a locale from an Accept-Language header, defaulting to Spanish. */
export function localeFromHeader(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.split(",")) {
    const tag = part.trim().split(";")[0].toLowerCase();
    if (tag.startsWith("es")) return "es";
    if (tag.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}
