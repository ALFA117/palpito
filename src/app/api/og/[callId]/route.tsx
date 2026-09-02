import { ImageResponse } from "next/og";
import { callById, outcomeOf } from "@/lib/indexer";
import { handleFor, shortAddress, windowLabel, money, asPercent } from "@/lib/format";
import { DICTS, DEFAULT_LOCALE } from "@/lib/i18n";

export const runtime = "nodejs";
export const revalidate = 60;

/**
 * Fixed dark palette, not the app's CSS variables: this renders to a static PNG
 * for a feed that does not carry a viewer's theme preference, so one deliberate
 * look is more honest than guessing.
 */
const COLORS = {
  bg: "#0a0810",
  text: "#f6f3fb",
  faint: "#8b82a8",
  border: "#2b2540",
  up: "#35e39b",
  down: "#ff5d7d",
  gold: "#ffc73d",
};

export async function GET(_req: Request, ctx: { params: Promise<{ callId: string }> }) {
  const { callId } = await ctx.params;
  const t = DICTS[DEFAULT_LOCALE];
  const call = await callById(callId).catch(() => null);

  if (!call) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: COLORS.bg,
            color: COLORS.faint,
            fontSize: 36,
          }}
        >
          Palpito
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  const outcome = outcomeOf(call);
  const up = call.direction === "UP";
  const verdictColor =
    outcome === "won" ? COLORS.up : outcome === "lost" ? COLORS.down : COLORS.faint;
  const verdictLabel =
    outcome === "won" ? t.won : outcome === "lost" ? t.lost : outcome === "void" ? t.void : t.pending;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: COLORS.bg,
          color: COLORS.text,
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 700 }}>
            <div style={{ width: 16, height: 16, borderRadius: 999, background: COLORS.gold }} />
            Palpito
          </div>
          <div style={{ display: "flex", fontSize: 20, color: COLORS.faint }}>{t.receiptTitle}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", fontSize: 76, fontWeight: 700 }}>{call.market.asset}</div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: 32,
                fontWeight: 600,
                color: up ? COLORS.up : COLORS.down,
                background: up ? "rgba(53,227,155,0.14)" : "rgba(255,93,125,0.14)",
                padding: "8px 22px",
                borderRadius: 16,
              }}
            >
              {up ? t.up : t.down}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 24,
                color: COLORS.faint,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                padding: "8px 18px",
              }}
            >
              {windowLabel(call.market.intervalSec)}
            </div>
          </div>

          <div style={{ display: "flex", gap: 56, marginTop: 44 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 46, fontWeight: 700 }}>
                {money(call.stake, DEFAULT_LOCALE)}
              </div>
              <div style={{ display: "flex", fontSize: 20, color: COLORS.faint, marginTop: 6 }}>
                {t.lblStake} · tUSDC
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 46,
                  fontWeight: 700,
                  color: up ? COLORS.up : COLORS.down,
                }}
              >
                {asPercent(call.price)}
              </div>
              <div style={{ display: "flex", fontSize: 20, color: COLORS.faint, marginTop: 6 }}>
                {t.lblPrice}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: verdictColor }}>
                {verdictLabel}
              </div>
              <div style={{ display: "flex", fontSize: 20, color: COLORS.faint, marginTop: 6 }}>
                {t.pnl}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            fontSize: 22,
            color: COLORS.faint,
          }}
        >
          <div style={{ display: "flex" }}>
            {handleFor(call.wallet)} · {shortAddress(call.wallet)}
          </div>
          <div style={{ display: "flex" }}>{t.poweredBy}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
