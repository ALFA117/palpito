import { leaderboard, BOARD_RANGES, type Board, type BoardRange } from "@/lib/indexer";
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
  // `?r=all` was the old "all time" tab, which only ever covered the latest
  // 2,000 calls; old links land on the widest range that is really complete.
  const range: BoardRange = isRange(raw) ? raw : raw === "all" ? "30d" : "24h";

  let board: Board | null = null;
  try {
    board = await leaderboard(range, 5, 15);
  } catch (err) {
    console.error("leaderboard load failed", err);
  }

  if (!board) return <LoadError />;
  return (
    <BoardView standings={board.standings} range={range} truncatedSince={board.truncatedSince} />
  );
}
