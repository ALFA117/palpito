import { describe, expect, it } from "vitest";
import { handleFor, formatLatency, countdown, shortAddress, asPercent } from "./format";

describe("handleFor", () => {
  it("is deterministic for the same address", () => {
    const a = "0x1234000000000000000000000000000000abcd";
    expect(handleFor(a)).toBe(handleFor(a.toUpperCase()));
  });

  it("carries 4 hex characters of suffix", () => {
    const handle = handleFor("0x1234000000000000000000000000000000abcd");
    expect(handle).toMatch(/[0-9a-f]{4}$/);
  });

  it("can still collide for two different wallets — this is why the address is always shown alongside it", () => {
    // Only chars 2-6 (the animal) and the last 4 (the suffix) feed the handle;
    // two addresses sharing both, differing everywhere in between, render the
    // same handle. That is the documented, accepted limit from BACKLOG #10 —
    // not a bug this test is catching, but the boundary it is pinning down.
    const a = handleFor("0x1234aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabcd");
    const b = handleFor("0x1234bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbabcd");
    expect(a).toBe(b);
  });
});

describe("formatLatency", () => {
  it("shows sub-second latency in milliseconds", () => {
    expect(formatLatency(420)).toBe("420ms");
  });

  it("switches to seconds at 1000ms", () => {
    expect(formatLatency(1000)).toBe("1.0s");
  });

  it("keeps one decimal place above a second", () => {
    expect(formatLatency(1834)).toBe("1.8s");
  });
});

describe("countdown", () => {
  it("reads 0s once past expiry", () => {
    expect(countdown(-5)).toBe("0s");
  });

  it("formats minutes and seconds under an hour", () => {
    expect(countdown(750)).toBe("12m 30s");
  });

  it("drops seconds once past an hour", () => {
    expect(countdown(2 * 3600 + 12 * 60)).toBe("2h 12m");
  });
});

describe("shortAddress", () => {
  it("keeps the first 6 and last 4 characters", () => {
    expect(shortAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234...5678");
  });
});

describe("asPercent", () => {
  it("rounds to the nearest whole percent", () => {
    expect(asPercent(0.327)).toBe("33%");
  });
});
