import { liveMarkets, outcomeOf, recentCalls, type Market } from "@/lib/indexer";
import { FeedView, type ScoredCall } from "@/components/FeedView";
import { LoadError } from "@/components/LoadError";
import { nowSeconds } from "@/lib/format";

export const revalidate = 10;

interface Snapshot {
  scored: ScoredCall[];
  markets: Market[];
  /** When this snapshot was taken. Seeds the client clock so countdowns hydrate cleanly. */
  takenAt: number;
}

export default async function FeedPage() {
  let snapshot: Snapshot | null = null;

  try {
    const takenAt = nowSeconds();
    const [calls, markets] = await Promise.all([recentCalls(40), liveMarkets()]);
    snapshot = {
      scored: calls.map((call) => ({ call, outcome: outcomeOf(call) })),
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
    <FeedView
      scored={snapshot.scored}
      markets={snapshot.markets}
      serverNow={snapshot.takenAt}
    />
  );
}
