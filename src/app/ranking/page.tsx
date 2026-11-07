import { leaderboard, BOARD_RANGES, type BoardRange, type Standing } from "@/lib/indexer";
import { BoardView } from "@/components/BoardView";
import { LoadError } from "@/components/LoadError";

export const revalidate = 60;

export const metadata = {
  title: "Ranking — Palpito",
  description: "Quién acierta de verdad: tasa de acierto y P&L de wallets con al menos 5 palpitos resueltos en DreamDEX (Somnia testnet).",
  alternates: { canonical: "/ranking" },
};

const isRange = (v: string | undefined): v is BoardRange =>
  BOARD_RANGES.includes(v as BoardRange);

export default async function RankingPage({ searchParams }: PageProps<"/ranking">) {
  const params = await searchParams;
  const raw = Array.isArray(params.r) ? params.r[0] : params.r;
  // 24h is the default on purpose: an all-time board on a venue this young is a
  // static list of whichever bots have run longest.
  const range: BoardRange = isRange(raw) ? raw : "24h";

  let standings: Standing[] | null = null;
  try {
    standings = await leaderboard(range, 5, 15);
  } catch (err) {
    console.error("leaderboard load failed", err);
  }

  if (!standings) return <LoadError />;
  return <BoardView standings={standings} range={range} />;
}
