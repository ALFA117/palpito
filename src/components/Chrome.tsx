"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import { LOCALES } from "@/lib/i18n";

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0">
      <span className="relative flex h-2.5 w-2.5">
        <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-gold" />
      </span>
      <span className="text-[17px] font-semibold tracking-tight">Palpito</span>
    </Link>
  );
}

function LangToggle() {
  const { locale, setLocale, switching } = useLocale();
  return (
    <div
      className="flex items-center rounded-full border border-border bg-surface p-0.5 text-[11px] font-medium"
      aria-busy={switching}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={l === locale}
          className={`rounded-full px-2.5 py-1 uppercase transition-colors ${
            l === locale ? "bg-surface-2 text-text" : "text-faint hover:text-muted"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function Chrome({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const pathname = usePathname();

  const tabs = [
    { href: "/", label: t.navFeed },
    { href: "/ranking", label: t.navBoard },
  ];

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-4 px-4">
          <Wordmark />
          <nav className="flex items-center gap-1 text-[13px]">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-3 py-1.5 transition-colors ${
                    active ? "bg-surface-2 text-text" : "text-muted hover:text-text"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto">
            <LangToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-5">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-1 px-4 py-6 text-[11px] text-faint">
          <span>{t.poweredBy}</span>
          <span>{t.testnetNotice}</span>
        </div>
      </footer>
    </>
  );
}
