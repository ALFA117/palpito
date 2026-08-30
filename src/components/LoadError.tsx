"use client";

import { useLocale } from "./LocaleProvider";

export function LoadError() {
  const { t } = useLocale();
  return (
    <p className="rounded-xl border border-border bg-surface p-5 text-[13px] text-muted">
      {t.loadError}
    </p>
  );
}
