"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Make the page tell the truth again, right after a write.
 *
 * Everything on screen is derived from two independent caches: the feed is a
 * server component on a 10-second revalidate, and positions, claims and the
 * book are react-query. Left alone, a user who just placed a call watches a page
 * that does not contain it for up to ten seconds — which reads as the call
 * having failed, on exactly the screen where they are least sure it worked.
 *
 * The indexer needs a beat to see the transaction, so the refresh runs twice:
 * once immediately for the caches that read the chain, and once shortly after
 * for the ones that read the indexer.
 */
export function useAfterWrite() {
  const router = useRouter();
  const qc = useQueryClient();

  return useCallback(() => {
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: ["positions"] });
      void qc.invalidateQueries({ queryKey: ["claims"] });
      void qc.invalidateQueries({ queryKey: ["binary-book"] });
      router.refresh();
    };
    refresh();
    const id = setTimeout(refresh, 2500);
    return () => clearTimeout(id);
  }, [qc, router]);
}
