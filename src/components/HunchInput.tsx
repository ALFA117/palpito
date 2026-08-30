"use client";

import { useState } from "react";
import { useLocale } from "./LocaleProvider";
import { parseHunch, isActionable, type Hunch } from "@/lib/parse";

const EXAMPLES_ES = [
  "el bitcoin sube en los próximos 15 minutos",
  "creo que eth cierra abajo hoy",
  "no creo que btc suba esta hora",
];
const EXAMPLES_EN = [
  "bitcoin closes up over the next 15 minutes",
  "I think eth ends the day lower",
  "I don't think btc rises this hour",
];

type State =
  | { k: "idle" }
  | { k: "reading" }
  | { k: "declined"; note: string | null };

/**
 * The sentence-first way in.
 *
 * Resolution runs in two stages so the app never depends on a network call it
 * might not be configured for: the deterministic parser answers first, and only
 * a sentence it could not turn into a call is sent to the model route. With no
 * API key that route reports itself unavailable and this degrades to "we could
 * not read that, here are examples" — still usable, just less forgiving.
 */
export function HunchInput({
  windows,
  onResolved,
}: {
  windows: number[];
  /** Fires with whatever was understood; the manual controls take it from there. */
  onResolved: (h: Hunch) => void;
}) {
  const { t, locale } = useLocale();
  const [text, setText] = useState("");
  const [state, setState] = useState<State>({ k: "idle" });

  const examples = locale === "es" ? EXAMPLES_ES : EXAMPLES_EN;

  async function read() {
    const sentence = text.trim();
    if (!sentence) return;

    const local = parseHunch(sentence, windows);
    if (isActionable(local)) {
      setState({ k: "idle" });
      onResolved(local);
      return;
    }

    setState({ k: "reading" });
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sentence }),
      });
      const data = await res.json();

      if (data?.available && data.understood && data.asset && data.direction) {
        setState({ k: "idle" });
        onResolved({
          asset: data.asset,
          direction: data.direction,
          windowSec: data.windowSec ?? local.windowSec,
          stake: data.stake ?? local.stake,
        });
        return;
      }

      // Partial reads are still worth keeping — naming the asset but not the
      // direction should preselect the asset rather than throw the sentence away.
      if (local.asset || local.direction) onResolved(local);

      setState({
        k: "declined",
        note: data?.available && typeof data.note === "string" ? data.note : null,
      });
    } catch {
      if (local.asset || local.direction) onResolved(local);
      setState({ k: "declined", note: null });
    }
  }

  const hint = (() => {
    if (state.k !== "declined") return null;
    if (state.note) return state.note;
    const local = parseHunch(text, windows);
    if (local.asset && !local.direction) return t.missingDirection;
    if (!local.asset && local.direction) return t.missingAsset;
    return t.cantDoThatBody;
  })();

  return (
    <div>
      <label
        htmlFor="hunch"
        className="mb-1.5 block text-[11px] uppercase tracking-wide text-faint"
      >
        {t.sayIt}
      </label>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void read();
        }}
      >
        <input
          id="hunch"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (state.k === "declined") setState({ k: "idle" });
          }}
          placeholder={t.sayItPlaceholder}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[14px] text-text outline-none placeholder:text-faint focus:border-gold/50"
        />
        <button
          type="submit"
          disabled={!text.trim() || state.k === "reading"}
          className="shrink-0 rounded-lg bg-gold px-4 py-2.5 text-[13px] font-semibold text-[#191014] transition-colors hover:bg-gold/90 disabled:opacity-50"
        >
          {state.k === "reading" ? t.reading : t.readIt}
        </button>
      </form>

      {state.k === "declined" ? (
        <div className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
          <p className="text-[12px] leading-relaxed text-muted">{hint}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-[11px] text-faint">{t.tryExample}</span>
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setText(ex);
                  setState({ k: "idle" });
                }}
                className="text-[11px] text-gold hover:underline"
              >
                “{ex}”
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-1.5 text-[11px] text-faint">{t.readItHint}</p>
      )}
    </div>
  );
}
