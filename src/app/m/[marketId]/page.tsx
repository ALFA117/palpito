import { notFound } from "next/navigation";
import { marketById, callsByMarket, outcomeOf, type Call, type Market } from "@/lib/indexer";
import { MarketView } from "@/components/MarketView";
import { LoadError } from "@/components/LoadError";
import type { ScoredCall } from "@/components/FeedView";
import { nowSeconds, windowLabel } from "@/lib/format";

export const revalidate = 10;

export async function generateMetadata({ params }: PageProps<"/m/[marketId]">) {
  const { marketId } = await params;
  const market = await marketById(marketId).catch(() => null);
  if (!market) return {};
  const title = `${market.asset} · ${windowLabel(market.intervalSec)} — Palpito`;
  return { title, openGraph: { title }, twitter: { title } };
}

export default async function MarketPage({ params }: PageProps<"/m/[marketId]">) {
  const { marketId } = await params;

  let snapshot: { market: Market; calls: Call[]; takenAt: number } | null = null;
  let missing = false;
  try {
    const takenAt = nowSeconds();
    const market = await marketById(marketId);
    if (!market) {
      missing = true;
    } else {
      snapshot = { market, calls: await callsByMarket(marketId), takenAt };
    }
  } catch (err) {
    console.error("market load failed", err);
  }

  if (missing) notFound();
  if (!snapshot) return <LoadError />;

  const scored: ScoredCall[] = snapshot.calls.map((call) => ({ call, outcome: outcomeOf(call) }));

  return <MarketView market={snapshot.market} scored={scored} serverNow={snapshot.takenAt} />;
}
