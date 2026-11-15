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
    <div className="lit-edge rounded-lg border border-border-bright bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="t-label text-text">{t.onboardTitle}</h2>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-11 rounded-md border border-border px-3 text-[13px] font-medium text-muted transition-colors hover:border-border-bright hover:text-text"
        >
          {t.onboardDone}
        </button>
      </div>
      <ol className="mt-4 flex flex-col divide-y divide-border border-t border-border text-[14px] leading-relaxed text-muted">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 py-3">
            <span className="t-figure flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border-bright text-[12px] text-text">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
