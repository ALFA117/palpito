"use client";

import { useState } from "react";
import type { ScoredCall } from "@/components/FeedView";

/**
 * Paging state for the feed's call list.
 *
 * The first page is real SSR data, seeded in as `initial`; every page after
 * that comes from `/api/calls`, which pages backward on the same timestamp
 * cursor the query is sorted by — see `recentCalls` for why that beats an
 * offset once the feed keeps growing underneath the request.
 */
export function useLoadMore(initial: ScoredCall[], asset: string | null, initialHasMore: boolean) {
  const [scored, setScored] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (loading || !hasMore || scored.length === 0) return;
    setLoading(true);
    try {
      const oldest = scored[scored.length - 1].call.timestamp;
      const qs = new URLSearchParams({ before: String(oldest) });
      if (asset) qs.set("asset", asset);

      const res = await fetch(`/api/calls?${qs}`);
      if (!res.ok) throw new Error(`load-more ${res.status}`);
      const data = (await res.json()) as { scored: ScoredCall[]; hasMore: boolean };

      setScored((prev) => [...prev, ...data.scored]);
      setHasMore(data.hasMore && data.scored.length > 0);
    } catch (err) {
      console.error("load more failed", err);
      // Left as retryable rather than permanently disabled: a transient
      // indexer hiccup should not be the reason "load more" stops existing.
    } finally {
      setLoading(false);
    }
  }

  return { scored, hasMore, loading, loadMore };
}
