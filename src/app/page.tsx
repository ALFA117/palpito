import { liveMarkets, outcomeOf, recentCalls, type Market } from "@/lib/indexer";
import { FeedView, type ScoredCall } from "@/components/FeedView";
import { LoadError } from "@/components/LoadError";
import { nowSeconds } from "@/lib/format";

export const revalidate = 10;

interface Snapshot {
  scored: ScoredCall[];
  hasMore: boolean;
  markets: Market[];
  /** When this snapshot was taken. Seeds the client clock so countdowns hydrate cleanly. */
  takenAt: number;
}

export default async function FeedPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const raw = Array.isArray(params.a) ? params.a[0] : params.a;
  const asset = raw === "BTC" || raw === "ETH" ? raw : null;

  let snapshot: Snapshot | null = null;

  try {
    const takenAt = nowSeconds();
    // Fetched oversized when filtering by asset — the venue runs two assets,
    // so a per-asset round-trip buys nothing and costs a cache entry, but
    // filtering after a plain 40-row fetch would starve the page.
    const [calls, markets] = await Promise.all([recentCalls(asset ? 80 : 40), liveMarkets()]);
    const visible = asset ? calls.filter((c) => c.market.asset === asset) : calls;
    snapshot = {
      scored: visible.slice(0, 40).map((call) => ({ call, outcome: outcomeOf(call) })),
      hasMore: calls.length >= 40,
      markets,
      takenAt,
    };
  } catch (err) {
    // The indexer is a third-party endpoint we do not control, and a blank feed
    // is indistinguishable from "nobody has called anything".
    console.error("feed load failed", err);
  }

  if (!snapshot) return <LoadError />;

  return (
    // Keyed on the asset filter: FeedView keeps its own "load more" state, and
    // switching filters has to reset that rather than append the new asset's
    // first page onto the old one's.
    <FeedView
      key={asset ?? "all"}
      scored={snapshot.scored}
      hasMore={snapshot.hasMore}
      markets={snapshot.markets}
      serverNow={snapshot.takenAt}
      asset={asset}
    />
  );
}
