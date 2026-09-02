import { describe, expect, it } from "vitest";
import { estimateProceeds, type BookSnapshot } from "./book";

const emptyBook: BookSnapshot = {
  up: null,
  down: null,
  upBid: null,
  downBid: null,
  yesBidDepth: [],
  yesAskDepth: [],
};

describe("estimateProceeds", () => {
  it("returns null when there is no resting depth on that side", () => {
    expect(estimateProceeds(emptyBook, "UP", 10)).toBeNull();
  });

  it("prices an UP sell directly off the YES bid depth", () => {
    const book: BookSnapshot = {
      ...emptyBook,
      yesBidDepth: [
        { price: 0.6, size: 5 },
        { price: 0.5, size: 100 },
      ],
    };
    // 5 at 0.6 + 5 at 0.5, once the top level is exhausted.
    expect(estimateProceeds(book, "UP", 10)).toBeCloseTo(5 * 0.6 + 5 * 0.5);
  });

  it("prices a DOWN sell as the complement of the YES ask depth", () => {
    const book: BookSnapshot = {
      ...emptyBook,
      yesAskDepth: [
        { price: 0.3, size: 5 }, // NO bid here is 1 - 0.3 = 0.7
        { price: 0.4, size: 100 }, // NO bid here is 0.6
      ],
    };
    expect(estimateProceeds(book, "DOWN", 10)).toBeCloseTo(5 * 0.7 + 5 * 0.6);
  });

  it("stops at the resting depth rather than pricing size that cannot fill", () => {
    const book: BookSnapshot = { ...emptyBook, yesBidDepth: [{ price: 0.5, size: 3 }] };
    // Only 3 contracts are resting; the estimate cannot invent a price for the
    // other 7 by extending the top level, so it prices exactly what is there.
    expect(estimateProceeds(book, "UP", 10)).toBeCloseTo(3 * 0.5);
  });
});
