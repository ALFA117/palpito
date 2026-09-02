import { describe, expect, it } from "vitest";
import { parseHunch, isActionable, snapWindow } from "./parse";

describe("parseHunch", () => {
  it("reads asset, direction and duration from a plain Spanish sentence", () => {
    const h = parseHunch("creo que el bitcoin sube en la próxima media hora", [900, 3600]);
    expect(h.asset).toBe("BTC");
    expect(h.direction).toBe("UP");
    expect(h.windowSec).toBe(3600); // 1800s requested, snapped to the closer real window
  });

  it("reads a plain English sentence", () => {
    const h = parseHunch("I think eth ends the day lower", [86400]);
    expect(h.asset).toBe("ETH");
    expect(h.direction).toBe("DOWN");
  });

  it("flips direction on a plain negation", () => {
    const h = parseHunch("no creo que suba el btc", []);
    expect(h.direction).toBe("DOWN");
  });

  it("flips direction on the English negation form", () => {
    const h = parseHunch("I don't think btc rises this hour", [3600]);
    expect(h.direction).toBe("DOWN");
  });

  it("straightens a smart apostrophe before matching a negation", () => {
    // A phone's autocorrect sends U+2019, not a plain "'" — this is the exact
    // bug the file's own `straighten` helper exists to prevent.
    const h = parseHunch("I don’t think btc rises", []);
    expect(h.direction).toBe("DOWN");
  });

  it("does not call a direction when both sides are named", () => {
    const h = parseHunch("no sé si sube o baja el bitcoin", []);
    expect(h.direction).toBeNull();
  });

  it("does not treat 'trabaja' as a bearish call via a 'baja' substring", () => {
    const h = parseHunch("hoy trabaja el bitcoin toda la tarde", []);
    expect(h.direction).toBeNull();
  });

  it("reads a dollar-sign stake", () => {
    expect(parseHunch("btc sube, apuesto $15", []).stake).toBe(15);
  });

  it("reads a decimal stake with a comma", () => {
    expect(parseHunch("pongo 12,5 en que sube", []).stake).toBe(12.5);
  });

  it("does not resolve 'mañana' to the 24h window", () => {
    // Every window is a rolling duration from now, capped at 24h — none of
    // them means "the calendar day after this one", so this must stay null
    // rather than silently answer with the 24h window as if it did.
    const h = parseHunch("creo que sube mañana", [900, 3600, 86400]);
    expect(h.windowSec).toBeNull();
  });

  it("still resolves 'hoy' to the 24h window", () => {
    const h = parseHunch("creo que sube hoy", [900, 3600, 86400]);
    expect(h.windowSec).toBe(86400);
  });
});

describe("isActionable", () => {
  it("requires both asset and direction", () => {
    expect(isActionable({ asset: "BTC", direction: "UP", windowSec: null, stake: null })).toBe(true);
    expect(isActionable({ asset: "BTC", direction: null, windowSec: null, stake: null })).toBe(false);
    expect(isActionable({ asset: null, direction: "UP", windowSec: null, stake: null })).toBe(false);
  });
});

describe("snapWindow", () => {
  it("returns null with nothing available", () => {
    expect(snapWindow(3600, [])).toBeNull();
  });

  it("prefers the longer window when equidistant on a log scale", () => {
    // 1800 is equally far in raw seconds from 900 and 3600, but "early" beats
    // "late" here — a 15-minute window would close before the half hour the
    // person meant.
    expect(snapWindow(1800, [900, 3600])).toBe(3600);
  });

  it("picks the exact match when one exists", () => {
    expect(snapWindow(3600, [900, 3600, 86400])).toBe(3600);
  });
});
