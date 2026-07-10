import { describe, expect, test } from "vitest";
import { getDictionary, isLocale, localeFromStorage, localeToStorage } from "@/lib/i18n";

describe("i18n helpers", () => {
  test("validates and persists supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("zh")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(localeFromStorage(localeToStorage("zh"))).toBe("zh");
    expect(localeFromStorage("fr")).toBeUndefined();
  });

  test("provides bilingual navigation labels", () => {
    expect(getDictionary("en").nav.dashboard).toBe("Dashboard");
    expect(getDictionary("zh").nav.dashboard).toBe("看板");
  });
});
