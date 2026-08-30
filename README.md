# Palpito

**Say it. Let the chain settle it.**

A social feed for price calls on [DreamDEX](https://docs.dreamdex.io) event contracts, running on Somnia testnet. You say what you think BTC or ETH will do, it becomes a real on-chain position, and minutes later the oracle publicly settles whether you were right — with a receipt anyone can audit.

Built for the Somnia × DreamDEX Event Contracts Hackathon. Spanish and English, Spanish by default.

---

## The problem

Everyone in crypto says they called it. Nobody proves it. Screenshots are editable, threads get deleted, and the loudest voice wins by default.

Event contracts already solve the hard half of this: a call becomes a fully-collateralized position that an on-chain oracle settles by itself, with no keeper and no operator in the loop. What was missing is the part humans actually use — somewhere to *see* the calls, see who made them, and see who turned out to be right.

Palpito is that layer.

## What it does

- **A feed of live calls.** Every card is a real fill on a real event-contract market, with a ticking countdown to its window close.
- **A verifiable receipt.** Once a market settles, every call links straight to its own resolution on the Prophecy oracle explorer — the price sources, the median, the block. Not our word for it.
- **A record nobody can edit.** Hit rate, settled calls and P&L for any wallet that has ever traded this venue, recomputed from the public indexer on every request. There is no database behind the reputation layer, on purpose.
- **A leaderboard of who is actually right**, over wallets with enough settled calls to mean something.
- **Making a call**, end to end: connect an injected wallet, pull testnet collateral from the public faucet without leaving the page, and buy the UP or DOWN side of a live window.
- **Getting out early.** Open positions surface under the composer with a live exit price; sell before the window closes instead of waiting for the result.
- **Agreeing or disagreeing in one tap.** Every live call in the feed carries *join* and *fade*; a settled one carries a receipt instead.
- **Saying it in words.** "no creo que el bitcoin suba esta hora" fills in ETH/DOWN/1h by itself; "who wins the derby on Sunday" gets told, plainly, what this venue can and cannot do.

## Why the social layer is not decoration

Event contracts settle a crossing of `Buy Up × Buy Down` by **minting a fresh pair** — two opposite-side buyers need no seller and no market maker. So on this venue, two people disagreeing *is* the liquidity event.

That is a strange property for a trading venue and a completely ordinary property for a social feed. Palpito leans on it twice. The calls marked `◇ created liquidity` are fills that existed only because two people took opposite sides of the same window — and the **fade** button next to every live call is that mechanism offered directly: disagreeing with someone here does not consume liquidity, it *is* the liquidity event.

## Running it

```bash
npm install && npm run dev
```

That is the whole setup. Every read path is public — the Somnia markets indexer needs no key, and the app ships with the deployed contract addresses. Open http://localhost:3000.

**To make a call**, you need two testnet balances:

1. **STT for gas** — from the Somnia faucet at <https://testnet.somnia.network/>.
2. **tUSDC to stake** — the button in the app calls the collateral token's public
   `faucet(uint256)` and mints you 10,000. No form, no queue, no asking anyone.

Step 1 has to come first: minting tUSDC is itself a transaction.

## Architecture

```
Next.js (App Router, RSC)
        │
        ├── reads ──▶ Somnia markets indexer (Hasura GraphQL, public)
        │              markets · fills · resolutions · venues
        │
        └── links ──▶ Prophecy oracle explorer (per-market resolution graph)
```

| Path | What it is |
|---|---|
| `src/lib/somnia.ts` | Chain, addresses, venue, window catalog |
| `src/lib/indexer.ts` | Every read + the scoring rules (`outcomeOf`, `buildStanding`) |
| `src/lib/i18n.ts` | Both dictionaries; a missing key is a type error |
| `src/lib/parse.ts` | The deterministic sentence parser |
| `src/lib/book.ts` | Live best-ask per side, read from the pool |
| `src/lib/useJoin.ts` | One-tap join / fade on someone else's call |
| `src/lib/positions.ts` | Open positions, from the indexer |
| `src/lib/useSell.ts` | Exiting a position before its window closes |
| `src/app/api/parse/route.ts` | The Claude fallback (optional) |
| `src/app/page.tsx` | The feed |
| `src/app/ranking/page.tsx` | Leaderboard |
| `src/app/u/[wallet]/page.tsx` | Any wallet's record |

**Network:** Somnia testnet (chain 50312). **Collateral:** tUSDC, 6 decimals, public faucet.

## Notes for the DreamDEX team

Things that cost real time, found while building this. Offered as the optional SDK/doc feedback report.

1. **`clobStatus` in the indexer is not usable as a liveness filter.** It still reads `Trading` on markets whose window closed over a month ago. Filtering on it returns a wall of expired rows and sorts the genuinely live markets off the end of the page. Liveness has to be derived from the clock instead — `expiry > now AND tradingStart <= now AND NOT finalized AND NOT voided`. The gotchas page warns that the indexed status *lags*, which reads as "by seconds"; in practice it does not converge at all.

2. **The public docs undersell the venue.** `trading/event-contracts.md` says "15-minute and 1-hour windows". Testnet is currently running 5m, 15m, 1h, 4h and 24h windows for both BTC and ETH — a much better story for anyone building a consumer app, and worth saying out loud.

3. **`VENUE_ID` really does move, and there is no documented way to discover it.** The bot kit warns about this and ships a value; there is no `venues` query in the docs to resolve it from. We infer it by counting live markets per venue, which works but is a heuristic every builder will have to reinvent.

4. **Test-harness markets share the venue with real ones.** Testnet carries 3s/45s/60s windows and questions prefixed `Pricefeed test:` alongside the real series. Anything user-facing has to allowlist real intervals, and a new test interval would otherwise leak straight into a consumer feed.

5. **The HTTP API's spot-only scope is easy to miss.** `GET /v0/markets` returns three spot pairs and no event contracts, with no error signalling that event contracts live elsewhere. A pointer in the response, or a documented note at the endpoint itself, would save a first-time integrator an hour.

6. **`lastPrice` is easy to mistake for a quote.** It is the last trade, and on a
   thin window it can sit an order of magnitude away from the live ask — we saw a
   market last-trade at 0.42 with a 0.044 ask resting. Anything user-facing has to
   read the book. A note on the field, or a `bestBid`/`bestAsk` pair on the market
   row, would stop a whole class of mispriced integrations.

7. **`getOutcomeBalance` in the recipes page does not compile.** The published
   snippet calls it positionally —
   `client.getOutcomeBalance(onchain.outcomeToken, me, onchain.yesId)` — but in
   markets-sdk 0.28.1 it takes a single params object,
   `{ outcomeToken, account, id }`. Following the docs passes a string where the
   object is expected, so both fields read `undefined` and the failure surfaces
   from deep inside viem as `Address "undefined" is invalid` on a `balanceOf`
   the caller never wrote. The error names neither the function nor the argument.

8. **`getMarketOnchain` returns a hollow object for a market that just rolled.**
   No throw, no null — `pool` and `outcomeToken` come back `undefined`, and the
   program continues until some later call trips over them with the same opaque
   viem error as above. On a venue whose whole design is that markets "die on
   schedule and respawn", this is a race every integrator will hit. Returning
   null, or throwing, would make it self-describing.

9. **The oracle explorer deep link is excellent and underadvertised.** `oracleQuestionId` → `prd.oracle.somnia.host/questions/{id}?view=graph` is the single most convincing thing an interface can show a non-crypto user. It deserves more than one line in `market-structure.md`.

## Reading a sentence

The composer resolves in two stages, and the order is the point.

A **deterministic parser** goes first. The domain is genuinely small — two assets,
two directions, five windows — so the phrasings people actually type resolve from
patterns, instantly and offline. That keeps the app working from a fresh clone
with no API key, and keeps the common path off the network entirely.

**Claude** handles what the parser could not read. The real work there is not
exotic phrasing, it is *declining well*: "will América win on Sunday" is a
perfectly reasonable thing to type into a prediction app, and the honest answer
is that DreamDEX event contracts are BTC/ETH price windows and nothing else. A
regex cannot say that — it can only fail to match. Set `ANTHROPIC_API_KEY` to
enable it; without one the composer falls back to a fixed explanation plus
worked examples, which is worse but not broken.

Two things that cost real time in the parser, both worth knowing if you extend it:

- **`gana` and `pierde` had to come out of the direction words.** They are the
  dominant verbs in Spanish sports talk, so "ganará el América el domingo" parsed
  as a bullish call — on exactly the request that must be declined cleanly. Nobody
  says "el bitcoin gana" when they mean it closes up, so the loss is nil.
- **Curly apostrophes are normalised before matching.** Phones autocorrect `'` to
  `’`, so `/don'?t think/` misses "I don’t think btc rises" and reads it as
  bullish — the exact opposite of what was typed. Inverting someone's call is the
  worst failure this parser has.

A requested duration snaps to the nearest real window, preferring the longer one
when it falls between two: a window that closes before the moment the person was
talking about answers a different question than the one they asked.

## The write path

Calls are placed as **immediate-or-cancel** orders. A resting limit would leave an
unfilled remainder on the book with escrow locked and no cancel UI here to
retrieve it — a quiet way to take money out of someone's wallet and leave it
somewhere they cannot see. An IOC either fills or does nothing, and the app says
which.

Three things it does before signing, each of them a documented way to lose money
or time on this venue:

- **Reads the price from the pool, not from the market row.** `lastPrice` is the
  last trade, not an offer: a window can last-trade at 0.42 while the live ask
  sits at 0.04. Quoting from it shows the wrong number and sizes the position
  against a price nobody is offering.
- **Gates on the on-chain status.** `Trading` is the only status that accepts
  orders, and the SDK skips simulation — so an order on a market that just locked
  reverts *after* the wallet has asked the user to sign and after they paid gas.
- **Checks the receipt.** A reverted write resolves rather than throwing, so a
  failed order looks like a successful one unless `receipt.status` is read by hand.

Selling is the same path with one asymmetry: a sell escrows the outcome tokens
themselves, so you can only sell what you hold. The size comes from the
**on-chain** balance rather than the indexed one — asking for a single contract
more than is held reverts, and per the point above, that revert would look like
a success.

## Status

Working against live testnet data: feed, leaderboard, wallet records, verifiable
receipts, wallet connect, faucet, placing a call, the sentence composer, one-tap
join and fade, selling out early, both locales.

Not yet built: nothing in the core loop. Remaining work is the demo video and
the deck.

## License

MIT.

---

# Palpito (español)

**Dilo. Que la cadena lo confirme.**

Un muro social de predicciones sobre los contratos de evento de DreamDEX, en la testnet de Somnia. Dices lo que crees que va a hacer el precio de BTC o ETH, se convierte en una posición real en cadena, y minutos después el oráculo publica si tenías razón — con un recibo que cualquiera puede auditar.

## El problema

En cripto todo el mundo dice que la vio venir. Nadie lo prueba. Las capturas se editan, los hilos se borran, y gana el que grita más fuerte.

Los contratos de evento ya resuelven la mitad difícil: tu predicción es una posición totalmente colateralizada que un oráculo en cadena liquida solo, sin keeper y sin operador de por medio. Lo que faltaba es la parte que la gente de verdad usa: un lugar donde *ver* las predicciones, quién las hizo, y a quién le salieron bien.

## Qué hace

- **Un muro de palpitos en vivo**, cada uno una operación real con cuenta regresiva hasta el cierre de su ventana.
- **Recibo verificable**: al liquidarse, cada palpito enlaza a su propia resolución en el explorador del oráculo — fuentes de precio, mediana, bloque.
- **Un récord que nadie puede editar**: aciertos, resueltos y resultado de cualquier wallet, recalculado desde el indexer público en cada visita. No hay base de datos detrás de la reputación, a propósito.
- **Un ranking de quién acierta de verdad**, sobre wallets con suficientes palpitos resueltos.

## Por qué lo social no es decoración

Cuando se cruzan `Comprar Sube × Comprar Baja`, el protocolo **emite un par nuevo**: dos compradores de lados opuestos no necesitan vendedor ni market maker. En este venue, que dos personas discrepen *es* el evento de liquidez.

Eso es raro para un mercado y completamente normal para una red social. Los palpitos marcados con `◇ creó liquidez` existen solo porque dos personas tomaron lados opuestos de la misma ventana.

## Correrlo

```bash
npm install && npm run dev
```

Eso es todo. Todas las lecturas son públicas: el indexer de Somnia no pide llave y la app trae las direcciones desplegadas.

**Red:** testnet de Somnia (chain 50312). **Colateral:** tUSDC, 6 decimales, con faucet público.
