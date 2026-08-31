"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTheme } from "./ThemeProvider";
import type { Theme } from "@/lib/theme";
import { useLocale } from "./LocaleProvider";

/** Sun, moon, and the half-filled circle that means "whatever the system says". */
const ICONS: Record<Theme, React.ReactNode> = {
  light: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  dark: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
  system: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
    </svg>
  ),
};

const ORDER: Theme[] = ["light", "system", "dark"];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();
  const reduce = useReducedMotion();

  const label: Record<Theme, string> = {
    light: t.themeLight,
    system: t.themeSystem,
    dark: t.themeDark,
  };

  // Three targets cost ~72px, which on a 375px header is the difference between
  // the connect button fitting and hanging off the edge. Narrow screens get one
  // button that cycles; anything wider keeps the segmented control.
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];

  return (
    <>
      <button
        type="button"
        onClick={() => setTheme(next)}
        aria-label={`${t.theme}: ${label[theme]}`}
        title={`${t.theme}: ${label[theme]}`}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted sm:hidden"
      >
        {reduce ? (
          ICONS[theme]
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              className="flex"
              initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              {ICONS[theme]}
            </motion.span>
          </AnimatePresence>
        )}
      </button>

      <div
        role="radiogroup"
        aria-label={t.theme}
        className="hidden items-center rounded-full border border-border bg-surface p-0.5 sm:flex"
      >
        {ORDER.map((v) => {
          const active = v === theme;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label[v]}
              title={label[v]}
              onClick={() => setTheme(v)}
              className="relative flex h-6 w-6 items-center justify-center rounded-full"
            >
              {active && !reduce && (
                <motion.span
                  layoutId="theme-pill"
                  className="absolute inset-0 rounded-full bg-surface-3"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              {active && reduce && <span className="absolute inset-0 rounded-full bg-surface-3" />}
              <span className={`relative z-10 ${active ? "text-text" : "text-faint"}`}>
                {ICONS[v]}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
