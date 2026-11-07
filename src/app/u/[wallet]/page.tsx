import { notFound } from "next/navigation";
import { buildStanding, callsByWallet, outcomeOf, type Call } from "@/lib/indexer";
import { ProfileView } from "@/components/ProfileView";
import { LoadError } from "@/components/LoadError";
import type { ScoredCall } from "@/components/FeedView";
import { nowSeconds } from "@/lib/format";

export const revalidate = 15;

/** Calls one profile reads. ~0.9 KB each with the market row, so ~430 KB. */
const PROFILE_CAP = 500;

export async function generateMetadata({ params }: PageProps<"/u/[wallet]">) {
  const { wallet } = await params;
  const short = `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
  return {
    title: `${short} — Palpito`,
    description: "Historial público de palpitos de esta wallet: aciertos, calibración y P&L recalculados desde el indexador.",
    alternates: { canonical: `/u/${wallet}` },
  };
}

const isAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);

export default async function ProfilePage({ params }: PageProps<"/u/[wallet]">) {
  const { wallet } = await params;
  if (!isAddress(wallet)) notFound();

  let snapshot: { calls: Call[]; takenAt: number } | null = null;
  try {
    const takenAt = nowSeconds();
    // One fetch, high-capped, for both: the standing and the history below
    // read off the same array rather than paying for a second round trip.
    // The cap is real — an active bot has thousands of calls — so when it is
    // hit the page says where the count starts (see `truncatedSince`).
    snapshot = { calls: await callsByWallet(wallet, PROFILE_CAP), takenAt };
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
      truncatedSince={
        snapshot.calls.length >= PROFILE_CAP
          ? (snapshot.calls[snapshot.calls.length - 1]?.timestamp ?? null)
          : null
      }
    />
  );
}
