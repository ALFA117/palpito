"use client";

import { useEffect, useState } from "react";
import { useLocale } from "./LocaleProvider";

const KEY = "palpito_onboarded";

/** Shown once, on whichever device first sees the feed — a local flag, not an account. */
export function Onboarding() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      // localStorage does not exist during SSR, so this cannot be a lazy
      // useState initializer — it has to run after mount, once.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      // A locked-down browser can throw on storage access; onboarding just
      // never shows rather than crashing the feed over it.
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Same as above: a failed write just means it may show again next visit.
    }
    setVisible(false);
  };

  const steps = [t.onboardStep1, t.onboardStep2, t.onboardStep3];

  return (
    <div className="lit-edge tint-gold mt-4 rounded-2xl border border-gold/25 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="t-label text-gold">{t.onboardTitle}</h2>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md border border-gold/30 px-2.5 py-1 text-[11px] font-medium text-gold transition-colors hover:bg-gold-dim/40"
        >
          {t.onboardDone}
        </button>
      </div>
      <ol className="mt-3 flex flex-col gap-2 text-[13px] leading-relaxed text-muted">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="t-figure shrink-0 text-gold">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
