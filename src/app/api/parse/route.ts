/**
 * The model half of the composer.
 *
 * `parseHunch` in lib/parse.ts reads the sentences people usually type, offline
 * and instantly. This route handles the rest — knottier phrasing, and the
 * requests this venue simply cannot serve. Declining well is most of the value
 * here: "will América win on Sunday" is a perfectly reasonable thing to type
 * into a prediction app, and the honest answer is that DreamDEX event contracts
 * are BTC/ETH price windows and nothing else. A regex cannot say that; it can
 * only fail to match.
 *
 * The route is optional by design. With no API key configured it reports itself
 * unavailable and the composer runs on the deterministic parser alone, so the
 * app is still fully usable from a fresh clone.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { WINDOWS, WINDOW_LABEL } from "@/lib/somnia";

export const runtime = "nodejs";

const HunchSchema = z.object({
  understood: z
    .boolean()
    .describe("True only if this is a BTC or ETH price-direction call this venue can serve."),
  asset: z.enum(["BTC", "ETH"]).nullable(),
  direction: z
    .enum(["UP", "DOWN"])
    .nullable()
    .describe("UP if they expect the price to close at or above the window's opening price."),
  windowSec: z
    .number()
    .nullable()
    .describe("One of the allowed window lengths in seconds, or null if they did not say."),
  stake: z.number().nullable().describe("Stake in tUSDC if they named an amount."),
  note: z
    .string()
    .describe(
      "One short sentence for the user, in THEIR language. When understood is false, say plainly what this venue cannot do and offer the closest thing it can.",
    ),
});

const SYSTEM = `You read one sentence and turn it into a prediction on DreamDEX event contracts.

The venue is narrow, and pretending otherwise is the worst thing you can do:
- The ONLY markets are "will BTC close at or above its opening price" and the same for ETH.
- Window lengths, in seconds: ${WINDOWS.join(", ")} (${WINDOWS.map((w) => WINDOW_LABEL[w]).join(", ")}).
- There are no sports, elections, news, or other assets. There are no custom price targets — the line is always the window's own opening price, so "BTC above $150k" cannot be expressed either.

Set understood=true only for a BTC or ETH direction call. Otherwise set it false, leave the fields null, and use "note" to say what is missing or why this cannot be done — briefly, without apologising, and offering the nearest real alternative when there is one.

Snap a requested duration to the closest allowed window, preferring the longer one when it is between two: a window that closes before the moment the person is talking about answers a different question than the one they asked.

Write "note" in the same language the user wrote in.`;

export async function POST(req: Request) {
  // An unset key is a supported configuration, not an error: the composer falls
  // back to the deterministic parser and the app keeps working.
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ available: false }, { status: 200 });
  }

  let text: string;
  try {
    const body = (await req.json()) as { text?: unknown };
    text = String(body.text ?? "").slice(0, 500);
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!text.trim()) return Response.json({ error: "empty" }, { status: 400 });

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: text }],
      output_config: { format: zodOutputFormat(HunchSchema) },
    });

    const parsed = response.parsed_output;
    if (!parsed) return Response.json({ available: true, understood: false, note: null });

    // The model is told the allowed windows, but a hallucinated one would put a
    // market that does not exist in front of the user — so drop anything the
    // venue is not actually running.
    const windowSec =
      parsed.windowSec !== null && (WINDOWS as readonly number[]).includes(parsed.windowSec)
        ? parsed.windowSec
        : null;

    return Response.json({ available: true, ...parsed, windowSec });
  } catch (err) {
    console.error("parse route failed", err);
    return Response.json({ available: false }, { status: 200 });
  }
}
