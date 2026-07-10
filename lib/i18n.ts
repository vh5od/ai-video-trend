export type Locale = "en" | "zh";

export const LOCALE_STORAGE_KEY = "ai-video-trend-locale";

export interface Dictionary {
  nav: {
    dashboard: string;
    trends: string;
    collection: string;
    platforms: string;
    settings: string;
  };
  common: {
    english: string;
    chinese: string;
  };
  dashboard: {
    eyebrow: string;
    title: string;
    description: string;
    trendCardsLink: string;
    showingWindow: string;
    tiktokSources: string;
    instagramSources: string;
    totalEngagement: string;
    mappedTrends: string;
    followUps: string;
  };
  controls: {
    timeWindow: string;
    platform: string;
    sort: string;
    today: string;
    yesterday: string;
    thisWeek: string;
    lastWeek: string;
    last7Days: string;
    last30Days: string;
    customRange: string;
    all: string;
    heat: string;
    latestPublished: string;
    collected: string;
    likes: string;
    comments: string;
    shares: string;
    start: string;
    end: string;
  };
  trends: {
    eyebrow: string;
    title: string;
    description: string;
    empty: string;
    sources: string;
    heat: string;
    openDetail: string;
  };
}

const dictionaries: Record<Locale, Dictionary> = {
  en: {
    nav: {
      dashboard: "Dashboard",
      trends: "Trends",
      collection: "Collection",
      platforms: "Platforms",
      settings: "Settings"
    },
    common: {
      english: "EN",
      chinese: "\u4e2d\u6587"
    },
    dashboard: {
      eyebrow: "Cross-platform source ranking",
      title: "Trend Dashboard",
      description:
        "TikTok and Instagram sources collected in the selected time window, ranked by heat and mapped back to trend topics.",
      trendCardsLink: "Trend Cards",
      showingWindow: "Showing sources published from",
      tiktokSources: "TikTok Sources",
      instagramSources: "Instagram Sources",
      totalEngagement: "Total Engagement",
      mappedTrends: "Mapped Trends",
      followUps: "Follow-ups"
    },
    controls: {
      timeWindow: "Time window",
      platform: "Platform",
      sort: "Sort",
      today: "Today",
      yesterday: "Yesterday",
      thisWeek: "This week",
      lastWeek: "Last week",
      last7Days: "Last 7 days",
      last30Days: "Last 30 days",
      customRange: "Custom range",
      all: "All",
      heat: "Heat",
      latestPublished: "Latest published",
      collected: "Collected time",
      likes: "Likes",
      comments: "Comments",
      shares: "Shares",
      start: "Start",
      end: "End"
    },
    trends: {
      eyebrow: "Trend card aggregation",
      title: "Trend Cards",
      description: "A card view of approved trend topics and their evidence signals.",
      empty: "No trend cards yet.",
      sources: "sources",
      heat: "Heat",
      openDetail: "Open detail"
    }
  },
  zh: {
    nav: {
      dashboard: "\u770b\u677f",
      trends: "\u8d8b\u52bf",
      collection: "\u91c7\u96c6",
      platforms: "\u5e73\u53f0",
      settings: "\u8bbe\u7f6e"
    },
    common: {
      english: "EN",
      chinese: "\u4e2d\u6587"
    },
    dashboard: {
      eyebrow: "\u8de8\u5e73\u53f0\u6570\u636e\u6392\u884c",
      title: "\u8d8b\u52bf\u770b\u677f",
      description:
        "\u6309\u6240\u9009\u65f6\u95f4\u7a97\u53e3\u5c55\u793a TikTok \u548c Instagram \u5165\u5e93\u6570\u636e\uff0c\u5e76\u6309\u70ed\u5ea6\u6620\u5c04\u5230\u8d8b\u52bf\u4e3b\u9898\u3002",
      trendCardsLink: "\u8d8b\u52bf\u5361\u7247",
      showingWindow: "\u5f53\u524d\u5c55\u793a\u53d1\u5e03\u65f6\u95f4",
      tiktokSources: "TikTok \u6570\u636e",
      instagramSources: "Instagram \u6570\u636e",
      totalEngagement: "\u603b\u4e92\u52a8",
      mappedTrends: "\u5df2\u6620\u5c04\u8d8b\u52bf",
      followUps: "\u503c\u5f97\u8ddf\u8fdb"
    },
    controls: {
      timeWindow: "\u65f6\u95f4\u7a97\u53e3",
      platform: "\u5e73\u53f0",
      sort: "\u6392\u5e8f",
      today: "\u4eca\u5929",
      yesterday: "\u6628\u5929",
      thisWeek: "\u672c\u5468",
      lastWeek: "\u4e0a\u5468",
      last7Days: "\u8fd1 7 \u5929",
      last30Days: "\u8fd1 30 \u5929",
      customRange: "\u81ea\u5b9a\u4e49",
      all: "\u5168\u90e8",
      heat: "\u70ed\u5ea6",
      latestPublished: "\u53d1\u5e03\u65f6\u95f4",
      collected: "\u5165\u5e93\u65f6\u95f4",
      likes: "\u70b9\u8d5e",
      comments: "\u8bc4\u8bba",
      shares: "\u5206\u4eab",
      start: "\u5f00\u59cb",
      end: "\u7ed3\u675f"
    },
    trends: {
      eyebrow: "\u8d8b\u52bf\u5361\u7247\u805a\u5408",
      title: "\u8d8b\u52bf\u5361\u7247",
      description:
        "\u4ee5\u5361\u7247\u65b9\u5f0f\u67e5\u770b\u5df2\u6279\u51c6\u6570\u636e\u5f62\u6210\u7684\u8d8b\u52bf\u4e3b\u9898\u548c\u8bc1\u636e\u3002",
      empty: "\u6682\u65e0\u8d8b\u52bf\u5361\u7247\u3002",
      sources: "\u6761\u6570\u636e",
      heat: "\u70ed\u5ea6",
      openDetail: "\u67e5\u770b\u8be6\u60c5"
    }
  }
};

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "zh";
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function localeToStorage(locale: Locale): string {
  return locale;
}

export function localeFromStorage(value: string | null | undefined): Locale | undefined {
  return isLocale(value) ? value : undefined;
}
