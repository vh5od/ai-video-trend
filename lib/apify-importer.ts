import type { Settings, SourceItem } from "./types";

export interface ApifyInstagramItem {
  id?: string;
  type?: string;
  shortCode?: string;
  caption?: string;
  hashtags?: string[];
  url?: string;
  commentsCount?: number;
  displayUrl?: string;
  images?: string[];
  videoUrl?: string;
  likesCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  timestamp?: string;
  ownerFullName?: string;
  ownerUsername?: string;
  inputUrl?: string;
  [key: string]: unknown;
}

export interface ImportApifyItemsInput {
  items: ApifyInstagramItem[];
  existingSources: SourceItem[];
  settings: Settings;
  now?: string;
  filterToKeywords?: boolean;
}

export interface ImportApifyItemsResult {
  imported: SourceItem[];
  skippedDuplicates: number;
  skippedUnmatched: number;
  skippedInvalid: number;
}

export function importApifyItems({
  items,
  existingSources,
  settings,
  now = new Date().toISOString(),
  filterToKeywords = true
}: ImportApifyItemsInput): ImportApifyItemsResult {
  const existingUrls = new Set(existingSources.map((source) => source.url));
  const existingExternalIds = new Set(
    existingSources.map((source) => source.externalId).filter(Boolean)
  );
  const imported: SourceItem[] = [];
  let skippedDuplicates = 0;
  let skippedUnmatched = 0;
  let skippedInvalid = 0;

  for (const item of items) {
    if (!item.url || !item.caption) {
      skippedInvalid += 1;
      continue;
    }

    const externalId = item.id || item.shortCode || item.url;
    if (existingUrls.has(item.url) || existingExternalIds.has(externalId)) {
      skippedDuplicates += 1;
      continue;
    }

    if (filterToKeywords && !matchesKeywords(item, settings.keywords)) {
      skippedUnmatched += 1;
      continue;
    }

    const source = mapApifyItemToSource(item, now);
    imported.push(source);
    existingUrls.add(source.url);
    existingExternalIds.add(source.externalId);
  }

  return {
    imported,
    skippedDuplicates,
    skippedUnmatched,
    skippedInvalid
  };
}

export function mapApifyItemToSource(
  item: ApifyInstagramItem,
  now = new Date().toISOString()
): SourceItem {
  const externalId = item.id || item.shortCode || item.url || `apify_${Date.now()}`;
  const title = firstSentence(item.caption ?? "") || "Instagram source";

  return {
    id: `src_apify_instagram_${safeId(externalId)}`,
    platform: "instagram",
    externalId,
    url: item.url ?? "",
    authorName: item.ownerFullName || item.ownerUsername || "Unknown creator",
    authorHandle: (item.ownerUsername ?? "").replace(/^@+/, "").toLowerCase(),
    title,
    text: item.caption ?? "",
    hashtags: normalizeHashtags(item.hashtags),
    language: "en",
    region: "unknown",
    mediaType: item.type?.toLowerCase() === "video" ? "video" : "post",
    publishedAt: item.timestamp || now,
    collectedAt: now,
    metrics: {
      views: item.videoViewCount ?? item.videoPlayCount,
      likes: item.likesCount,
      comments: item.commentsCount,
      shares: undefined
    },
    thumbnailUrl: item.displayUrl || item.images?.[0],
    videoUrl: item.videoUrl,
    embedUrl: item.shortCode
      ? `https://www.instagram.com/p/${item.shortCode}/embed/`
      : undefined,
    raw: {
      source: "apify_instagram_scraper",
      inputUrl: item.inputUrl,
      item
    },
    seeded: false
  };
}

export function matchesKeywords(
  item: Pick<ApifyInstagramItem, "caption" | "hashtags">,
  keywords: string[]
): boolean {
  const text = `${item.caption ?? ""} ${(item.hashtags ?? []).join(" ")}`.toLowerCase();
  const normalizedText = text.replace(/[^a-z0-9]+/g, " ").trim();
  const tokens = new Set(normalizedText.split(/\s+/).filter(Boolean));
  const compactText = normalizedText.replace(/[^a-z0-9]+/g, "");

  return keywords.some((keyword) => {
    const normalized = keyword.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const compact = normalized.replace(/[^a-z0-9]+/g, "");

    if (!normalized.includes(" ") && compact.length <= 4) {
      return tokens.has(compact);
    }

    return normalizedText.includes(normalized) || compactText.includes(compact);
  });
}

function normalizeHashtags(hashtags?: string[]): string[] {
  return Array.from(
    new Set(
      (hashtags ?? [])
        .map((tag) => tag.trim().replace(/^#+/, "").toLowerCase())
        .filter(Boolean)
    )
  );
}

function firstSentence(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 96) return cleaned;
  return `${cleaned.slice(0, 93)}...`;
}

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
