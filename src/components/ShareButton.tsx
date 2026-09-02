"use client";

import { useState } from "react";
import { useLocale } from "./LocaleProvider";

/** Copies the call's shareable receipt link — the one with an OG image attached. */
export function ShareButton({ callId }: { callId: string }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}/c/${callId}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          window.prompt(t.share, url);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="font-medium text-faint transition-colors hover:text-gold"
    >
      {copied ? t.shareCopied : t.share}
    </button>
  );
}
