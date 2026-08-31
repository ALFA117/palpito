/**
 * Theme identity, in a plain module.
 *
 * The layout is a server component and needs to validate the cookie before it
 * can stamp `data-theme` on the first paint. A `"use client"` file cannot be
 * called from there — only rendered — so the type and its guard live here,
 * away from the provider.
 */
export type Theme = "system" | "light" | "dark";

export const THEME_COOKIE = "palpito_theme";

export const isTheme = (v: string | undefined | null): v is Theme =>
  v === "system" || v === "light" || v === "dark";
