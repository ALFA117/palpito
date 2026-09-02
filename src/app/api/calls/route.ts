/**
 * "Load more" for the feed.
 *
 * The feed renders server-side for the first page — that is what makes the
 * first paint real data instead of a skeleton — but a click on "load more" is
 * a user action, not a navigation, so it is fine to answer it from a plain API
 * route rather than a full page render.
 */

import { recentCalls, outcomeOf } from "@/lib/indexer";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const assetParam = url.searchParams.get("asset");
  const asset = assetParam === "BTC" || assetParam === "ETH" ? assetParam : null;
  const beforeParam = url.searchParams.get("before");
  const before = beforeParam ? Number(beforeParam) : undefined;

  if (before !== undefined && !Number.isFinite(before)) {
    return Response.json({ error: "bad_cursor" }, { status: 400 });
  }

  try {
    // Fetched oversized and filtered after, same as the feed's first page:
    // the venue runs two assets, so a per-asset round-trip buys nothing.
    const raw = await recentCalls(asset ? 80 : 40, before);
    const calls = asset ? raw.filter((c) => c.market.asset === asset).slice(0, 40) : raw;

    return Response.json({
      scored: calls.map((call) => ({ call, outcome: outcomeOf(call) })),
      hasMore: raw.length >= (asset ? 80 : 40),
    });
  } catch (err) {
    console.error("calls load-more failed", err);
    return Response.json({ error: "load_failed" }, { status: 502 });
  }
}
