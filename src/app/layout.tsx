import type { Metadata } from "next";
import { Inter_Tight, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { DEFAULT_LOCALE, isLocale, localeFromHeader } from "@/lib/i18n";
import { LocaleProvider } from "@/components/LocaleProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { isTheme, THEME_COOKIE, type Theme } from "@/lib/theme";
import { Chrome } from "@/components/Chrome";
import { Web3Provider } from "@/components/Web3Provider";

// "Instrument": Inter Tight for headlines (a tight, upright grotesque), IBM Plex
// Sans for everything read, IBM Plex Mono for every number — prices,
// countdowns, addresses, hashes.
const display = Inter_Tight({
  variable: "--font-display-sans",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});
const body = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});
const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const DESCRIPTION =
  "Dilo y que la cadena lo confirme. Palpitos sobre BTC y ETH con recibo verificable, en los contratos de evento de DreamDEX sobre la testnet de Somnia: fichas de prueba, sin dinero real.";

export const metadata: Metadata = {
  metadataBase: new URL("https://palpito-somnia.vercel.app"),
  title: "Palpito",
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Palpito — Dilo. Que la cadena lo confirme.",
    description: DESCRIPTION,
    type: "website",
    locale: "es_MX",
    alternateLocale: "en_US",
  },
  twitter: { card: "summary_large_image", title: "Palpito", description: DESCRIPTION },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const savedTheme = cookieStore.get(THEME_COOKIE)?.value;
  const theme: Theme = isTheme(savedTheme) ? savedTheme : "system";

  const saved = cookieStore.get("palpito_locale")?.value;
  const locale = isLocale(saved)
    ? saved
    : localeFromHeader(headerList.get("accept-language")) ?? DEFAULT_LOCALE;

  return (
    <html
      lang={locale}
      // "system" stamps nothing on purpose, leaving prefers-color-scheme in charge.
      data-theme={theme === "system" ? undefined : theme}
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text">
        <ThemeProvider theme={theme}>
          <Web3Provider>
            <LocaleProvider locale={locale}>
              <Chrome>{children}</Chrome>
            </LocaleProvider>
          </Web3Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}
