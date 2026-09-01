"use client";

import { NavLink } from "./RouteProgress";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useLocale } from "./LocaleProvider";
import { LOCALES } from "@/lib/i18n";
import { ConnectButton } from "./ConnectButton";
import { ThemeToggle } from "./ThemeToggle";

function Wordmark() {
  return (
    <NavLink href="/" className="flex shrink-0 items-center gap-2" aria-label="Palpito">
      <span className="relative flex h-2 w-2">
        <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-gold" />
        <span className="absolute inline-flex h-full w-full rounded-full bg-gold/30 blur-[3px]" />
      </span>
      <span className="t-title hidden text-[16px] sm:inline">Palpito</span>
    </NavLink>
  );
}

/**
 * The active pill slides between tabs instead of blinking on and off.
 *
 * One `layoutId` and Motion tweens the position for us — no measuring, no
 * manual offsets. It is the cheapest thing in this whole redesign that makes
 * navigation feel built rather than assembled.
 */
function Tabs() {
  const { t } = useLocale();
  const pathname = usePathname();
  const reduce = useReducedMotion();

  const tabs = [
    { href: "/", label: t.navFeed },
    { href: "/ranking", label: t.navBoard },
  ];

  return (
    <nav className="flex items-center gap-0.5 text-[13px]">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <NavLink
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className="relative rounded-full px-3 py-1.5 transition-colors"
          >
            {active && !reduce && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-full bg-surface-3"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            {active && reduce && (
              <span className="absolute inset-0 rounded-full bg-surface-3" />
            )}
            <span
              className={`relative z-10 ${active ? "font-medium text-text" : "text-muted hover:text-text"}`}
            >
              {tab.label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function LangToggle() {
  const { locale, setLocale, switching } = useLocale();
  const reduce = useReducedMotion();

  return (
    <div
      className="relative flex items-center rounded-full border border-border bg-surface p-0.5 text-[10px] font-semibold"
      aria-busy={switching}
    >
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            aria-pressed={active}
            className="relative rounded-full px-2 py-1 uppercase tracking-wider"
          >
            {active && !reduce && (
              <motion.span
                layoutId="lang-pill"
                className="absolute inset-0 rounded-full bg-surface-3"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            {active && reduce && (
              <span className="absolute inset-0 rounded-full bg-surface-3" />
            )}
            <span className={`relative z-10 ${active ? "text-text" : "text-faint"}`}>{l}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Chrome({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-2 px-4 sm:gap-4">
          <Wordmark />
          <Tabs />
          <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <LangToggle />
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-6">{children}</main>

      <footer className="border-t border-border bg-bg-deep">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1.5 px-4 py-8">
          <span className="t-label">{t.poweredBy}</span>
          <span className="text-[11px] text-faint">{t.testnetNotice}</span>
        </div>
      </footer>
    </>
  );
}
