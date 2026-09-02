import { notFound } from "next/navigation";
import { callById, outcomeOf } from "@/lib/indexer";
import { CallCard } from "@/components/CallCard";
import { LoadError } from "@/components/LoadError";
import { ClockProvider } from "@/components/Clock";
import { nowSeconds } from "@/lib/format";

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps<"/c/[callId]">) {
  const { callId } = await params;
  const call = await callById(callId).catch(() => null);
  if (!call) return {};

  const title = `${call.market.asset} ${call.direction === "UP" ? "↑" : "↓"} — Palpito`;
  const images = [`/api/og/${callId}`];
  return { title, openGraph: { title, images }, twitter: { title, images, card: "summary_large_image" } };
}

export default async function CallPage({ params }: PageProps<"/c/[callId]">) {
  const { callId } = await params;

  let call = null;
  try {
    call = await callById(callId);
  } catch (err) {
    console.error("call load failed", err);
    return <LoadError />;
  }
  if (!call) notFound();

  return (
    <ClockProvider now={nowSeconds()}>
      <div className="mx-auto max-w-md">
        <CallCard call={call} outcome={outcomeOf(call)} />
      </div>
    </ClockProvider>
  );
}
