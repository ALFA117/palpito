"use client";

import { useAccount } from "wagmi";
import { usePositions } from "@/lib/usePositions";
import { useResolutionNotices } from "@/lib/useResolutionNotice";
import { NavLink } from "./RouteProgress";
import { useLocale } from "./LocaleProvider";

export function ResolutionToast() {
  const { t } = useLocale();
  const { address } = useAccount();
  const { data: positions } = usePositions(address);
  const { notices, dismiss } = useResolutionNotices(positions);

  if (notices.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex flex-col items-center gap-2 px-4">
      {notices.map((n) => (
        <div
          key={n.id}
          className="pointer-events-auto flex items-center gap-3 rounded-xl border border-gold/30 bg-surface px-4 py-2.5 text-[13px] shadow-lg"
        >
          <span className={`font-semibold ${n.direction === "UP" ? "text-up" : "text-down"}`}>
            {n.asset}
          </span>
          <span className="text-muted">{t.windowResolved}</span>
          <NavLink
            href={`/m/${n.marketId}`}
            onClick={() => dismiss(n.id)}
            className="font-medium text-gold transition-colors hover:text-gold/80"
          >
            {t.seeResult}
          </NavLink>
          <button
            type="button"
            onClick={() => dismiss(n.id)}
            aria-label={t.dismiss}
            className="text-faint transition-colors hover:text-muted"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
