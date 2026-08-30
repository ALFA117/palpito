import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { DEFAULT_LOCALE, isLocale, localeFromHeader } from "@/lib/i18n";
import { LocaleProvider } from "@/components/LocaleProvider";
import { Chrome } from "@/components/Chrome";
import { Web3Provider } from "@/components/Web3Provider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text">
        <Web3Provider>
          <LocaleProvider locale={locale}>
            <Chrome>{children}</Chrome>
          </LocaleProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
