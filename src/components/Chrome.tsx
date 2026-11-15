"use client";

import { NavLink } from "./RouteProgress";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useLocale } from "./LocaleProvider";
import { LOCALES } from "@/lib/i18n";
import { ConnectButton } from "./ConnectButton";
import { ThemeToggle } from "./ThemeToggle";
import { ResolutionToast } from "./ResolutionToast";

function Wordmark() {
  return (
    <NavLink href="/" className="flex min-h-11 min-w-11 shrink-0 items-center gap-2.5" aria-label="Palpito">
      {/* The mark: one heartbeat inside a square — up-spike, down-spike. */}
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-text text-bg">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M1.5 10h4l2-5 3.5 10 2.5-7 1.5 2h3.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="hidden font-display text-[20px] font-semibold tracking-[-0.02em] sm:inline">Palpito</span>
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
    <nav className="flex items-center gap-0.5 text-[14px]">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <NavLink
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className="relative flex h-16 items-center px-3 transition-colors"
          >
            {active && !reduce && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-x-3 bottom-0 h-[2px] bg-text"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            {active && reduce && <span className="absolute inset-x-3 bottom-0 h-[2px] bg-text" />}
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
      className="relative flex items-center rounded-md border border-border bg-surface p-0.5 text-[12px] font-semibold"
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
            className="relative flex h-11 min-w-11 items-center justify-center rounded-md px-2 uppercase tracking-wider"
          >
            {active && !reduce && (
              <motion.span
                layoutId="lang-pill"
                className="absolute inset-0 rounded-md bg-surface-3"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            {active && reduce && (
              <span className="absolute inset-0 rounded-md bg-surface-3" />
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
  // The wall gets a two-column desk on wide screens; every other page reads
  // best as a single measured column.
  const wide = usePathname() === "/";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-bg">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:gap-6 sm:px-6">
          <Wordmark />
          <Tabs />
          <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
            {/* Below 420px there is no room for preferences beside the wallet
                at full touch size, so they move to the footer. */}
            <div className="hidden items-center gap-1.5 min-[420px]:flex sm:gap-2">
              <ThemeToggle />
              <LangToggle />
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      <ResolutionToast />

      <main className={`mx-auto w-full flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-10 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>{children}</main>

      <footer className="border-t border-border bg-surface-2">
        {/* pb-24 on phones: the wall's floating "make a call" button sits in
            the bottom-right corner and would otherwise cover this text. */}
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1.5 px-4 pb-24 pt-8 sm:px-6 sm:pb-10">
          <span className="t-label">{t.poweredBy}</span>
          <span className="max-w-[70ch] text-[13px] leading-relaxed text-muted">{t.testnetNotice}</span>
          <div className="mt-3 flex items-center gap-2 min-[420px]:hidden">
            <ThemeToggle />
            <LangToggle />
          </div>
        </div>
      </footer>
    </>
  );
}
