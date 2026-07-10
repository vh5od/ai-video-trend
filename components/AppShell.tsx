"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Database, Languages, Settings, Table2, TrendingUp } from "lucide-react";
import {
  getDictionary,
  localeFromStorage,
  localeToStorage,
  LOCALE_STORAGE_KEY,
  type Dictionary,
  type Locale
} from "@/lib/i18n";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dictionary: Dictionary;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const navItems = [
  { href: "/", labelKey: "dashboard", icon: BarChart3 },
  { href: "/trends", labelKey: "trends", icon: TrendingUp },
  { href: "/collection", labelKey: "collection", icon: Database },
  { href: "/platforms", labelKey: "platforms", icon: Table2 },
  { href: "/settings", labelKey: "settings", icon: Settings }
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = localeFromStorage(window.localStorage.getItem(LOCALE_STORAGE_KEY));
    if (stored) {
      setLocaleState(stored);
    }
  }, []);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, localeToStorage(nextLocale));
  };

  const dictionary = useMemo(() => getDictionary(locale), [locale]);
  const contextValue = useMemo(
    () => ({ locale, setLocale, dictionary }),
    [dictionary, locale]
  );

  return (
    <I18nContext.Provider value={contextValue}>
      <div className="min-h-screen border-l border-line bg-slate-50 text-ink">
        <aside className="fixed inset-y-0 left-0 flex w-56 flex-col border-r border-line bg-white">
          <div className="border-b border-line px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Private Radar
            </p>
            <h1 className="mt-1 text-lg font-semibold">AI Video Trends</h1>
          </div>
          <nav className="space-y-1 px-3 py-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {dictionary.nav[item.labelKey]}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-line p-3">
            <div className="flex items-center gap-2 rounded-md border border-line bg-slate-50 p-1">
              <Languages className="ml-2 h-4 w-4 text-muted" aria-hidden="true" />
              <button
                type="button"
                className={`flex-1 rounded px-2 py-1 text-xs font-semibold ${
                  locale === "en" ? "bg-white text-ink shadow-sm" : "text-muted"
                }`}
                onClick={() => setLocale("en")}
              >
                {dictionary.common.english}
              </button>
              <button
                type="button"
                className={`flex-1 rounded px-2 py-1 text-xs font-semibold ${
                  locale === "zh" ? "bg-white text-ink shadow-sm" : "text-muted"
                }`}
                onClick={() => setLocale("zh")}
              >
                {dictionary.common.chinese}
              </button>
            </div>
          </div>
        </aside>
        <main className="ml-56 min-h-screen px-8 py-6">{children}</main>
      </div>
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside AppShell");
  }
  return value;
}
