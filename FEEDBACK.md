# SDK & docs feedback — DreamDEX event contracts

Everything below was hit while building [Palpito](https://palpito-somnia.vercel.app),
a consumer app on the testnet event-contract venue. Ordered by how much time each
one cost, not by severity. Versions: `@somnia-chain/markets-sdk@0.28.1`, testnet
(chain 50312), venue `0x679795a0…`, late August 2026.

Two things up front, because criticism reads better with them said: the **oracle
explorer deep link** and the **mint-a-pair fill path** are the two best things about
this venue, and both are under-advertised. More on that at the end.

---

## 1. `clobStatus` cannot be used as a liveness filter

**Cost: ~2 hours, and it silently produced an empty app.**

The indexed `clobStatus` still reads `Trading` on markets whose window closed over a
month ago. Filtering on it and sorting by expiry returns a wall of expired rows and
pushes every genuinely live market off the end of the page:

```
ETH 900s status=Trading expiry=1784729700  (closed 38 days ago)
BTC 900s status=Trading expiry=1784729700  (closed 38 days ago)
…60 rows, none of them live
```

The gotchas page warns that indexed status *lags*, which reads as "by seconds". In
practice it does not converge at all. What works is deriving liveness from the clock,
the same way on-chain status is derived:

```graphql
expiry: { _gt: $now }
tradingStart: { _lte: $now }
finalized: { _eq: false }
voided: { _eq: false }
```

**Suggestion:** either stop writing terminal statuses to that column, or say plainly
in the gotchas that it is not a filter. The current wording implies it is usable with
a tolerance.

## 2. The recipes page's `getOutcomeBalance` call does not compile

**Cost: ~40 minutes, with an error that names neither the function nor the argument.**

Published:

```ts
const up = await exchange.client.getOutcomeBalance(onchain.outcomeToken, me, onchain.yesId);
```

Actual signature in 0.28.1 — a single params object:

```ts
getOutcomeBalance(p: { outcomeToken: Address; account: Address; id: bigint }): Promise<bigint>
```

Following the docs passes a string where the object goes, so `outcomeToken` and
`account` both read `undefined`, and the failure surfaces from deep inside viem as:

```
RpcError: rpc readContract balanceOf failed: Address "undefined" is invalid.
```

There is no `balanceOf` in the caller's code, so the error points nowhere useful.

**Suggestion:** update the snippet. A runtime guard that names the missing field
would also turn a 40-minute hunt into a 10-second fix.

## 3. `getMarketOnchain` returns a hollow object for a market that just rolled

**Cost: ~30 minutes, twice, because it is a race and did not reproduce on demand.**

When a market rolls between the indexer read and the call, `getMarketOnchain`
resolves with `pool` and `outcomeToken` `undefined` — no throw, no null. The program
continues and trips over them several calls later with the same opaque viem error as
above.

On a venue whose stated design is that markets "die on schedule and respawn", every
integrator will hit this. We now gate every write on
`status === 1 && pool && outcomeToken` and report it as "the window closed", which is
what it actually is.

**Suggestion:** return `null`, or throw a named error. Silence plus `undefined` is the
worst of the three options.

## 4. The public docs undersell the venue

`trading/event-contracts.md` says "BTC and ETH markets on 15-minute and 1-hour
windows today". Testnet is running **5m, 15m, 1h, 4h and 24h** for both assets.

That is a materially better story for anyone building a consumer app — a 5-minute
window is a product loop, and a 24-hour one is a feed that stays alive overnight. We
only found the real range by listing markets.

## 5. Test-harness markets share the venue with real ones

Testnet carries 3s/45s/60s windows, and questions prefixed `Pricefeed test:` with
non-zero strikes, alongside the real rolling series. Both are on live venues in the
indexer.

Anything user-facing has to **allowlist** real intervals and `strike = 0` rather than
exclude the junk, because a new test interval would otherwise leak straight into a
consumer feed — and a strike-based question rendered under "closes above its opening
price" describes the wrong bet entirely.

**Suggestion:** a separate venue for the harness, or a flag on the row.

## 6. `VENUE_ID` moves, and there is no documented way to discover it

The bot kit ships a value and warns it changed three times in the first week of
August. There is no `venues` query in the docs to resolve it from. Testnet currently
hosts four venues side by side; we infer the right one by counting live markets per
venue, which works but is a heuristic every builder will reinvent differently.

**Suggestion:** a documented "current venue" endpoint, or a `primary` flag.

## 7. `lastPrice` is easy to mistake for a quote

It is the last trade, not an offer, and on a thin window the gap is not subtle. We
measured a market whose `lastPrice` was **0.42 while the live ask was 0.044** — an
order of magnitude. An app that quotes from it shows a wrong number *and* sizes the
position against a price nobody is offering.

We also saw the reverse: windows with `lastPrice = null` (no trades yet) but a real
0.49 ask resting. Pricing from `lastPrice` makes those markets look untradeable.

**Suggestion:** a `bestBid`/`bestAsk` pair on the market row would remove a whole
class of mispriced integrations. Failing that, a warning on the field.

## 8. The HTTP API's spot-only scope is easy to miss

`GET /v0/markets` returns three spot pairs and no event contracts, with nothing in
the response signalling that event contracts live elsewhere. The line in the docs is
easy to skim past. A pointer in the payload would save a first-time integrator an
hour of wondering why the venue looks empty.

## 9. Nothing tells a user they have unclaimed winnings

Not an SDK bug — a gap in the surrounding story, and the one with real money in it.

A settled market pays out only when someone asks, so a position does not decay into
collateral on its own. While building the claim flow we queried live balances on
finalised markets and found wallets sitting on **5,854 tUSDC** and **4,672 tUSDC** of
unclaimed wins. These look like bots that trade continuously and never redeem.

`redeemMany` makes sweeping them a single signature and works exactly as documented.
The gap is purely that nothing surfaces the debt.

**Suggestion:** an indexer field for claimable value per account would let every
frontend show it without reconstructing the join.

## 10. Chain reads are WebSocket-only, and that path does not work in a browser

**Cost: several hours, because the failure is silence.**

`getBinaryOrderBook`, `getMarketOnchain` and `getOutcomeBalance` all go through
the SDK's chain client, and that client requires `wsRpcUrl`:

```
NotConfiguredError: this operation needs chain access — needs wsRpcUrl in
createClient (or a chain whose rpcUrls carry a webSocket endpoint)
```

An HTTP `rpcUrls.default` on the viem chain is not accepted. That is a strong
constraint to place on every read, and it is not mentioned in the recipes.

Worse, with `wsRpcUrl` set, those same reads **hang indefinitely in a browser** —
no error, no rejection, no failed request in the network panel — while working
fine from Node against the same endpoint, and while a raw
`new WebSocket(wsRpcUrl)` opens successfully from the same page.

We replaced the book read with a direct viem `eth_call` on
`getBookLevels(bool,uint64)` and derived the NO sides ourselves
(`price = 1 − yesPrice`). It returns byte-identical results to
`getBinaryOrderBook` on every live pool we compared, in ~200ms.

We have since moved **every** call off the SDK — reads and writes both — onto
plain viem over HTTP. The app no longer depends on `@somnia-chain/markets-sdk` at
all. Before doing that we checked the encodings against it: `getBookLevels`,
`markets(bytes32)` and the ERC-6909 `balanceOf` return identical values on live
markets, and `placeBinaryOrder` calldata is **byte-identical to
`buildPlaceOrder`** on all four sides.

**Suggestions:** support an HTTP transport — these are `eth_call`s and
`eth_sendTransaction`, nothing more; and if the WebSocket path is required, make
a failed or stalled connection reject rather than hang. As it stands the SDK is
unusable from a browser, which rules it out for every consumer frontend.

## 11. The realtime React hooks never started for us

**Cost: ~90 minutes, and it fails silently.**

We wanted the feed to tail the chain rather than poll, which is the natural fit
for a venue whose selling point is settlement speed. Under
`SomniaMarketsProvider`, with `useLiveFills(pool, 8)` mounted per live pool:

- `useIsTailing()` stayed `false` indefinitely — checked at 15s, 35s and after a
  full reload on a production deployment.
- No error, no console warning, no failed request.
- A `new WebSocket("wss://api.infra.testnet.somnia.network/ws")` opened fine by
  hand from the same page, so the transport and the origin are not the problem.
- `@somnia-chain/reactivity` is a **peerDependency and was not installed** — npm
  did not pull it and nothing said so. Installing it (0.2.1) did not change the
  behaviour, but a missing peer that the realtime path imports should surely be a
  hard error rather than nothing at all.

We shipped a three-second indexer poll instead, because a feature that is
silently inert is worse than a plainer one that works.

**Suggestions:** make the missing peer dependency throw at import; give
`useLiveStatus()` a reason field when a watch cannot start; and add a minimal
end-to-end React example to the docs — every realtime snippet we found was a
signature, not a working mount.

---

## What is genuinely excellent

**The oracle explorer deep link.** `oracleQuestionId` →
`prd.oracle.somnia.host/questions/{id}?view=graph` gives every market a public page
showing the question, every price source with its receipt, the median, and the block.
For a non-crypto user this is the single most convincing thing an interface can show —
it turns "trust us" into "check it yourself". It gets one line in
`market-structure.md` and deserves a page.

**Mint-a-pair.** A crossing of Buy-Up against Buy-Down mints a fresh pair, so two
opposite-side buyers need no seller and no market maker. It is described as a
cold-start mechanism, which undersells it: it means a social product where two people
disagree *generates* liquidity rather than consuming it. That is a genuinely unusual
property and it should be a headline, not a row in a table.

**Settlement with nobody in the loop.** Gas reserved at creation, the oracle callback
delivered by on-chain reactivity, and two permissionless backstops. We removed an
entire planned component — an "AI resolver" — after reading that page, because the
chain already does it better. That is the right reaction for a protocol to provoke.
