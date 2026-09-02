import { describe, expect, it } from "vitest";
import { buildStanding, outcomeOf, payoutOf, type Call, type Market } from "./indexer";

let seq = 0;

function makeMarket(overrides: Partial<Market> = {}): Market {
  seq += 1;
  return {
    marketId: `0x${seq}`,
    asset: "BTC",
    intervalSec: 3600,
    expiry: 1_000_000 + seq,
    tradingStart: 1_000_000 - 3600,
    clobStatus: "Trading",
    finalized: false,
    voided: false,
    winningOutcome: null,
    oracleQuestionId: null,
    lastPrice: null,
    tradeCount: 0,
    volume: 0,
    venueId: "venue",
    poolAddress: null,
    spark: [],
    ...overrides,
  };
}

function makeCall(overrides: Omit<Partial<Call>, "market"> & { market?: Partial<Market> } = {}): Call {
  seq += 1;
  const { market, ...rest } = overrides;
  return {
    id: `call-${seq}`,
    wallet: "0xabc",
    direction: "UP",
    price: 0.5,
    size: 10,
    stake: 5,
    timestamp: seq,
    txHash: `0xtx${seq}`,
    mintedPair: false,
    kind: "TAKE",
    market: makeMarket(market),
    ...rest,
  };
}

describe("outcomeOf", () => {
  it("is pending on an unfinalized market", () => {
    expect(outcomeOf(makeCall({ market: { finalized: false } }))).toBe("pending");
  });

  it("is void on a voided market regardless of winningOutcome", () => {
    expect(outcomeOf(makeCall({ market: { voided: true, finalized: true, winningOutcome: 0 } }))).toBe(
      "void",
    );
  });

  it("is won when UP called and YES (0) won", () => {
    expect(
      outcomeOf(makeCall({ direction: "UP", market: { finalized: true, winningOutcome: 0 } })),
    ).toBe("won");
  });

  it("is lost when UP called and NO (1) won", () => {
    expect(
      outcomeOf(makeCall({ direction: "UP", market: { finalized: true, winningOutcome: 1 } })),
    ).toBe("lost");
  });

  it("is won when DOWN called and NO (1) won", () => {
    expect(
      outcomeOf(makeCall({ direction: "DOWN", market: { finalized: true, winningOutcome: 1 } })),
    ).toBe("won");
  });
});

describe("payoutOf", () => {
  it("pays the full size on a win", () => {
    const c = makeCall({ size: 12, direction: "UP", market: { finalized: true, winningOutcome: 0 } });
    expect(payoutOf(c)).toBe(12);
  });

  it("pays half the size on a void", () => {
    const c = makeCall({ size: 12, market: { voided: true, finalized: true } });
    expect(payoutOf(c)).toBe(6);
  });

  it("pays nothing on a loss or while pending", () => {
    const lost = makeCall({ direction: "UP", market: { finalized: true, winningOutcome: 1 } });
    const pending = makeCall({ market: { finalized: false } });
    expect(payoutOf(lost)).toBe(0);
    expect(payoutOf(pending)).toBe(0);
  });
});

describe("buildStanding", () => {
  it("scores an empty history as a light record", () => {
    const s = buildStanding("0xabc", []);
    expect(s.hitRate).toBeNull();
    expect(s.pnl).toBe(0);
    expect(s.streak).toBe(0);
    expect(s.calibration).toEqual([]);
  });

  it("computes hit rate over settled calls only, excluding void and pending", () => {
    const calls: Call[] = [
      makeCall({ direction: "UP", size: 10, stake: 5, market: { finalized: true, winningOutcome: 0 } }), // won
      makeCall({ direction: "UP", size: 10, stake: 5, market: { finalized: true, winningOutcome: 1 } }), // lost
      makeCall({ market: { voided: true, finalized: true } }), // void — excluded from hit rate
      makeCall({ market: { finalized: false } }), // pending — excluded
    ];
    const s = buildStanding("0xabc", calls);
    expect(s.won).toBe(1);
    expect(s.lost).toBe(1);
    expect(s.void).toBe(1);
    expect(s.pending).toBe(1);
    expect(s.hitRate).toBe(0.5);
  });

  it("computes pnl as returned minus staked over settled and void calls", () => {
    const calls: Call[] = [
      makeCall({ direction: "UP", size: 10, stake: 4, market: { finalized: true, winningOutcome: 0 } }), // +10, -4
      makeCall({ direction: "UP", size: 10, stake: 6, market: { finalized: true, winningOutcome: 1 } }), // +0, -6
    ];
    const s = buildStanding("0xabc", calls);
    expect(s.staked).toBe(10);
    expect(s.returned).toBe(10);
    expect(s.pnl).toBe(0);
  });

  it("counts a streak back from the most recent settled call, skipping voids", () => {
    const calls: Call[] = [
      makeCall({ timestamp: 1, direction: "UP", market: { finalized: true, winningOutcome: 1 } }), // lost, oldest
      makeCall({ timestamp: 2, direction: "UP", market: { finalized: true, winningOutcome: 0 } }), // won
      makeCall({ timestamp: 3, market: { voided: true, finalized: true } }), // void, does not break the streak
      makeCall({ timestamp: 4, direction: "UP", market: { finalized: true, winningOutcome: 0 } }), // won, newest
    ];
    const s = buildStanding("0xabc", calls);
    expect(s.streak).toBe(2);
  });

  it("negates the streak on a losing run", () => {
    const calls: Call[] = [
      makeCall({ timestamp: 1, direction: "UP", market: { finalized: true, winningOutcome: 0 } }),
      makeCall({ timestamp: 2, direction: "UP", market: { finalized: true, winningOutcome: 1 } }),
      makeCall({ timestamp: 3, direction: "UP", market: { finalized: true, winningOutcome: 1 } }),
    ];
    const s = buildStanding("0xabc", calls);
    expect(s.streak).toBe(-2);
  });

  it("omits a calibration band with fewer than the minimum settled calls", () => {
    const calls: Call[] = [
      makeCall({ price: 0.9, direction: "UP", market: { finalized: true, winningOutcome: 0 } }),
    ];
    expect(buildStanding("0xabc", calls).calibration).toEqual([]);
  });

  it("reports a calibration band once it has enough settled calls", () => {
    const calls: Call[] = Array.from({ length: 4 }, () =>
      makeCall({ price: 0.75, direction: "UP", market: { finalized: true, winningOutcome: 0 } }),
    );
    const bands = buildStanding("0xabc", calls).calibration;
    expect(bands).toHaveLength(1);
    expect(bands[0]).toMatchObject({ n: 4, actual: 1, claimed: 0.75 });
  });
});
