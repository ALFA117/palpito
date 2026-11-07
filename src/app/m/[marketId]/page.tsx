import { notFound } from "next/navigation";
import {
  marketById,
  callsByMarket,
  marketReceipt,
  outcomeOf,
  type Call,
  type Market,
  type Receipt,
} from "@/lib/indexer";
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
  // A child `openGraph` replaces the root one whole, file-based image
  // included, so the share image is named again here or the page has none.
  const images = ["/opengraph-image.png"];
  return {
    title,
    alternates: { canonical: `/m/${marketId}` },
    openGraph: { title, images },
    twitter: { card: "summary_large_image", title, images },
  };
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

  // The receipt only exists once the window settled. A failed read is not a
  // failed page: the view says the receipt could not be read and moves on.
  let receipt: Receipt | null = null;
  if (snapshot.market.finalized) {
    receipt = await marketReceipt(
      snapshot.market.marketId,
      snapshot.market.oracleQuestionId,
    ).catch((err) => {
      console.error("receipt load failed", err);
      return null;
    });
  }

  const scored: ScoredCall[] = snapshot.calls.map((call) => ({ call, outcome: outcomeOf(call) }));

  return (
    <MarketView
      market={snapshot.market}
      scored={scored}
      serverNow={snapshot.takenAt}
      receipt={receipt}
    />
  );
}
