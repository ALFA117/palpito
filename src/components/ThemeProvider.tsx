"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

interface Ctx {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeCtx = createContext<Ctx | null>(null);

/**
 * Three states, not two: light, dark, and following the system.
 *
 * The choice lives in a cookie so the server stamps `data-theme` on the first
 * paint — a client-only toggle flashes the wrong theme on every navigation, and
 * on a page this dark that flash is the whole screen.
 *
 * `system` deliberately stamps nothing, leaving `prefers-color-scheme` in
 * charge, which is what most people actually want and what the stylesheet is
 * written around.
 */
export function ThemeProvider({
  theme: initial,
  children,
}: {
  theme: Theme;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(initial);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  // Applied to <html> from the client too, so switching is instant rather than
  // waiting on a round-trip. The server still sets it for the first paint.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
