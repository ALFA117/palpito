import { describe, expect, it } from "vitest";
import { toTickPrice, toLotSize, TICK, LOT } from "./trade";
import { ONE } from "./somnia";

describe("toTickPrice", () => {
  it("snaps down to the nearest tick", () => {
    // 0.5001 * 1e6 = 500100, which is not on the 1000-unit grid.
    expect(toTickPrice(0.5001)).toBe(500_000n);
  });

  it("never quotes exactly 0 — floors to one tick", () => {
    expect(toTickPrice(0)).toBe(TICK);
  });

  it("never quotes exactly 1 — caps at one tick below the top", () => {
    expect(toTickPrice(1)).toBe(BigInt(ONE) - TICK);
  });

  it("rounds a tiny probability up to the minimum tradable price", () => {
    // 0.0002 rounds to 200, which floors below the grid's first tick.
    expect(toTickPrice(0.0002)).toBe(TICK);
  });
});

describe("toLotSize", () => {
  it("floors to the lot grid rather than rounding", () => {
    // 2.9999 contracts at ONE=1e6 raw units, LOT=1 — floors the fractional
    // raw unit rather than rounding it up into a lot the caller didn't ask for.
    expect(toLotSize(2.9999999)).toBe(BigInt(Math.floor(2.9999999 * ONE)));
  });

  it("floors a whole number cleanly", () => {
    expect(toLotSize(3)).toBe(3n * BigInt(ONE) / LOT * LOT);
  });

  it("floors a sub-lot amount to zero", () => {
    expect(toLotSize(0)).toBe(0n);
  });
});
