"use client";

import { createContext, useCallback, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DICTS, type Dict, type Locale } from "@/lib/i18n";

interface Ctx {
  locale: Locale;
  t: Dict;
  setLocale: (l: Locale) => void;
  switching: boolean;
}

const LocaleCtx = createContext<Ctx | null>(null);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [switching, startTransition] = useTransition();

  /**
   * The locale lives in a cookie so the server can render the right copy on the
   * first paint — a client-only toggle would flash Spanish at English readers on
   * every navigation.
   */
  const setLocale = useCallback(
    (l: Locale) => {
      document.cookie = `palpito_locale=${l}; path=/; max-age=31536000; samesite=lax`;
      startTransition(() => router.refresh());
    },
    [router],
  );

  return (
    <LocaleCtx.Provider value={{ locale, t: DICTS[locale], setLocale, switching }}>
      {children}
    </LocaleCtx.Provider>
  );
}

export function useLocale(): Ctx {
  const ctx = useContext(LocaleCtx);
  if (!ctx) throw new Error("useLocale must be used inside <LocaleProvider>");
  return ctx;
}
