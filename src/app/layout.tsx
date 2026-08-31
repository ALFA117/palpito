import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { DEFAULT_LOCALE, isLocale, localeFromHeader } from "@/lib/i18n";
import { LocaleProvider } from "@/components/LocaleProvider";
import { Chrome } from "@/components/Chrome";
import { Web3Provider } from "@/components/Web3Provider";

// Space Grotesk for anything that speaks, Inter for anything that is read, and
// JetBrains Mono for every number — prices, countdowns, addresses, hashes. The
// old build ran on one family, which is most of why it read as a template.
const display = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});
const body = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});
const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const DESCRIPTION =
  "Dilo y que la cadena lo confirme. Predicciones con recibo verificable sobre contratos de evento de DreamDEX en Somnia.";

export const metadata: Metadata = {
  metadataBase: new URL("https://palpito-somnia.vercel.app"),
  title: "Palpito",
  description: DESCRIPTION,
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
  const saved = cookieStore.get("palpito_locale")?.value;
  const locale = isLocale(saved)
    ? saved
    : localeFromHeader(headerList.get("accept-language")) ?? DEFAULT_LOCALE;

  return (
    <html
      lang={locale}
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      {/* `room` paints the grid and the ambient wash behind everything. */}
      <body className="room min-h-full flex flex-col bg-bg text-text">
        <Web3Provider>
          <LocaleProvider locale={locale}>
            <Chrome>{children}</Chrome>
          </LocaleProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
