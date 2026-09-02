import { notFound } from "next/navigation";
import { buildStanding, callsByWallet, outcomeOf, type Call } from "@/lib/indexer";
import { ProfileView } from "@/components/ProfileView";
import { LoadError } from "@/components/LoadError";
import type { ScoredCall } from "@/components/FeedView";
import { nowSeconds } from "@/lib/format";

export const revalidate = 15;

const isAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);

export default async function ProfilePage({ params }: PageProps<"/u/[wallet]">) {
  const { wallet } = await params;
  if (!isAddress(wallet)) notFound();

  let snapshot: { calls: Call[]; takenAt: number } | null = null;
  try {
    const takenAt = nowSeconds();
    // One fetch, high-capped, for both: the standing needs full history to
    // score hit rate and calibration correctly, and the history below reads
    // off the same array rather than paying for a second round trip.
    snapshot = { calls: await callsByWallet(wallet, 500), takenAt };
  } catch (err) {
    console.error("profile load failed", err);
  }

  if (!snapshot) return <LoadError />;

  const scored: ScoredCall[] = snapshot.calls.map((call) => ({
    call,
    outcome: outcomeOf(call),
  }));

  return (
    <ProfileView
      standing={buildStanding(wallet, snapshot.calls)}
      scored={scored}
      serverNow={snapshot.takenAt}
    />
  );
}
