"use client";

import { NavLink } from "@/components/RouteProgress";
import { useLocale } from "@/components/LocaleProvider";

/**
 * A 404 in the app's own language and frame.
 *
 * Next's default is an English one-liner on a site that speaks Spanish first;
 * most of the links that land here are a mistyped wallet or a market id that
 * was cut off when it was pasted.
 */
export default function NotFound() {
  const { t } = useLocale();
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="t-label text-gold">404</p>
      <h1 className="t-title mt-2 text-[22px]">{t.notFoundTitle}</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">{t.notFoundBody}</p>
      <NavLink
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-gold px-5 text-[14px] font-semibold text-on-gold transition-colors hover:bg-gold/90"
      >
        {t.backToFeed}
      </NavLink>
    </div>
  );
}
