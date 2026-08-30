"use client";

import { useQuery } from "@tanstack/react-query";
import { recentCallsClient } from "@/lib/live";
import type { Call } from "@/lib/indexer";
import { CallCard } from "./CallCard";
import { useLocale } from "./LocaleProvider";
import { useNow } from "./Clock";

/**
 * Calls arriving while you watch.
 *
 * The server feed revalidates every ten seconds, which is fine for history and
 * wrong for the thing this product is about: on a five-minute window, ten
 * seconds is a meaningful share of the whole decision.
 *
 * This polls the indexer every three seconds instead of using the SDK's realtime
 * tail. That was the first choice and it did not work: `useLiveFills` under
 * `SomniaMarketsProvider` never started — `useIsTailing()` stayed false
 * indefinitely with no error, no console warning, and a WebSocket to the same
 * endpoint opening fine by hand from the same page. Installing the missing
 * `@somnia-chain/reactivity` peer dependency did not change it either. Rather
 * than ship a feature that is silently inert, the mechanism is one that is
 * verified end to end; the finding is written up in FEEDBACK.md.
 */
export function LiveFeed({
  asset,
  knownIds,
}: {
  asset: string | null;
  /** Ids already rendered by the server feed, so nothing appears twice. */
  knownIds: string[];
}) {
  const { t } = useLocale();

  const { data, isSuccess } = useQuery<Call[]>({
    queryKey: ["live-calls", asset],
    refetchInterval: 3_000,
    // Keep the previous page of calls on screen while the next fetch is in
    // flight, so the section does not blink out between polls.
    placeholderData: (prev) => prev,
    queryFn: () => recentCallsClient(12, asset),
  });

  const known = new Set(knownIds);
  const now = useNow();

  const fresh = (data ?? []).filter(
    (c) =>
      !known.has(c.id) &&
      // Only calls on windows that are still open: a settled one belongs in the
      // history below, not in the part of the page that means "just happened".
      c.market.expiry > now,
  );

  if (!isSuccess) return null;

  return (
    <>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-faint">
        <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-up" />
        {t.tailing}
      </p>

      {fresh.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {fresh.map((call) => (
            <div key={call.id} className="rounded-xl ring-1 ring-gold/30">
              <CallCard call={call} outcome="pending" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
