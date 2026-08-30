import { leaderboard, type Standing } from "@/lib/indexer";
import { BoardView } from "@/components/BoardView";
import { LoadError } from "@/components/LoadError";

export const revalidate = 60;

export default async function RankingPage() {
  let standings: Standing[] | null = null;
  try {
    standings = await leaderboard(5, 15);
  } catch (err) {
    console.error("leaderboard load failed", err);
  }

  if (!standings) return <LoadError />;
  return <BoardView standings={standings} />;
}
