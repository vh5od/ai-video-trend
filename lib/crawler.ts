import type {
  CollectorStatus,
  CrawlerImportResult,
  CrawlerMode,
  CrawlerProvider,
  CrawlerSortRule,
  CrawlerTask,
  CrawlerTaskInput,
  CrawlerValidationResult,
  Platform,
  ProviderStatus,
  SourceItem,
  SourceMetrics
} from "./types";

const crawlerPlatforms = new Set<Platform>(["instagram", "tiktok"]);
const crawlerModes = new Set<CrawlerMode>(["hashtag", "keyword", "account"]);
const crawlerProviders = new Set<CrawlerProvider>([
  "manual_import",
  "provider_api",
  "official_api",
  "browser_session"
]);
const crawlerSortRules = new Set<CrawlerSortRule>([
  "as_provided",
  "latest",
  "highest_heat"
]);

export function validateCrawlerTask(input: CrawlerTaskInput): CrawlerValidationResult {
  const errors: string[] = [];

  if (!input.platform || !crawlerPlatforms.has(input.platform)) {
    errors.push("Platform must be instagram or tiktok.");
  }

  if (!input.mode || !crawlerModes.has(input.mode)) {
    errors.push("Mode must be hashtag, keyword, or account.");
  }

  if (!input.provider || !crawlerProviders.has(input.provider)) {
    errors.push("Provider must be manual_import, provider_api, official_api, or browser_session.");
  }

  const query = normalizeQuery(input.query ?? "", input.mode);
  if (!query) {
    errors.push("Query is required.");
  }

  if (input.provider === "manual_import" && !Array.isArray(input.items)) {
    errors.push("Manual import requires an items array.");
  }

  const sortBy = input.sortBy ?? "as_provided";
  if (!crawlerSortRules.has(sortBy)) {
    errors.push("Sort rule must be as_provided, latest, or highest_heat.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    task: {
      platform: input.platform as CrawlerTask["platform"],
      mode: input.mode as CrawlerMode,
      query,
      provider: input.provider as CrawlerProvider,
      limit: clampLimit(input.limit),
      sortBy,
      items: input.items,
      filterToKeywords: input.filterToKeywords !== false
    }
  };
}

export function importCrawlerItems({
  task,
  existingSources,
  keywords = [],
  minLikes = 0,
  now = new Date().toISOString()
}: {
  task: CrawlerTask;
  existingSources: SourceItem[];
  keywords?: string[];
  minLikes?: number;
  now?: string;
}): CrawlerImportResult {
  const existingByUrl = new Map(existingSources.map((source) => [source.url, source]));
  const existingByExternalId = new Map(
    existingSources
      .map((source) => [source.externalId, source] as const)
      .filter(([externalId]) => Boolean(externalId))
  );
  const imported: SourceItem[] = [];
  const updated: SourceItem[] = [];
  const candidates: SourceItem[] = [];
  let skippedDuplicates = 0;
  let skippedUnmatched = 0;
  let skippedBelowMinLikes = 0;
  let skippedInvalid = 0;

  for (const raw of task.items ?? []) {
    const source =
      task.platform === "instagram"
        ? normalizeInstagramCrawlerItem(raw, task, now)
        : normalizeTikTokCrawlerItem(raw, task, now);

    if (!source) {
      skippedInvalid += 1;
      continue;
    }

    const duplicate = existingByUrl.get(source.url) || existingByExternalId.get(source.externalId);
    if (duplicate) {
      const merged = mergeBetterCrawlerSource(duplicate, source);
      if (merged !== duplicate) {
        updated.push(merged);
        existingByUrl.set(merged.url, merged);
        existingByExternalId.set(merged.externalId, merged);
      }
      skippedDuplicates += 1;
      continue;
    }

    if (task.filterToKeywords && keywords.length > 0 && !matchesKeywords(source, keywords)) {
      skippedUnmatched += 1;
      continue;
    }

    if (source.metrics.likes !== undefined && source.metrics.likes < minLikes) {
      skippedBelowMinLikes += 1;
      continue;
    }

    existingByUrl.set(source.url, source);
    existingByExternalId.set(source.externalId, source);
    candidates.push(source);
  }

  imported.push(...sortSources(candidates, task.sortBy).slice(0, task.limit));

  return {
    imported,
    updated,
    skippedDuplicates,
    skippedUnmatched,
    skippedBelowMinLikes,
    skippedInvalid,
    itemsFound: task.items?.length ?? 0
  };
}

export function normalizeCrawlerItemForSource({
  raw,
  task,
  now
}: {
  raw: unknown;
  task: CrawlerTask;
  now: string;
}): SourceItem | undefined {
  return task.platform === "instagram"
    ? normalizeInstagramCrawlerItem(raw, task, now)
    : normalizeTikTokCrawlerItem(raw, task, now);
}

export function applyCrawlerItemUpdates(
  sources: SourceItem[],
  updatedSources: SourceItem[]
): SourceItem[] {
  if (updatedSources.length === 0) {
    return sources;
  }

  const updatesById = new Map(updatedSources.map((source) => [source.id, source]));
  const updatesByUrl = new Map(updatedSources.map((source) => [source.url, source]));
  const usedUpdateIds = new Set<string>();
  const nextSources = sources.map((source) => {
    const update = updatesById.get(source.id) || updatesByUrl.get(source.url);
    if (!update) {
      return source;
    }
    usedUpdateIds.add(update.id);
    return update;
  });

  for (const update of updatedSources) {
    if (!usedUpdateIds.has(update.id)) {
      nextSources.unshift(update);
    }
  }

  return nextSources;
}

export function getCrawlerProviderStatuses(
  env: Readonly<Record<string, string | undefined>> = process.env
): ProviderStatus[] {
  return ["instagram", "tiktok"].flatMap((platform) => [
    providerStatus({
      platform: platform as CrawlerTask["platform"],
      provider: "manual_import",
      status: "ready",
      message: `${titleCase(platform)} JSON import is ready for hashtag, keyword, and account tasks.`,
      capabilities: ["hashtag", "keyword", "account", "json_import"],
      missing: []
    }),
    providerStatus({
      platform: platform as CrawlerTask["platform"],
      provider: "provider_api",
      status: hasProviderApiToken(platform, env) ? "ready" : "not_configured",
      message: hasProviderApiToken(platform, env)
        ? `${titleCase(platform)} provider API credentials are configured.`
        : `${titleCase(platform)} provider API credentials are not configured.`,
      capabilities: ["hashtag", "keyword", "account", "api_collection"],
      missing: hasProviderApiToken(platform, env)
        ? []
        : [`${platform.toUpperCase()}_PROVIDER_API_TOKEN`]
    }),
    providerStatus({
      platform: platform as CrawlerTask["platform"],
      provider: "official_api",
      status: hasOfficialToken(platform, env) ? "ready" : "not_configured",
      message: hasOfficialToken(platform, env)
        ? `${titleCase(platform)} official API credentials are configured.`
        : `${titleCase(platform)} official API credentials are not configured.`,
      capabilities: ["credential_check", "official_api_adapter"],
      missing: hasOfficialToken(platform, env)
        ? []
        : [`${platform.toUpperCase()}_OFFICIAL_API_TOKEN`]
    }),
    providerStatus({
      platform: platform as CrawlerTask["platform"],
      provider: "browser_session",
      status: "partial",
      message: `${titleCase(platform)} browser-session collection connects to a local Chrome/Edge DevTools endpoint and uses the logged-in page state.`,
      capabilities: ["hashtag", "keyword", "account", "local_cdp_browser_session"],
      missing: ["BROWSER_CDP_URL or http://127.0.0.1:9222"]
    })
  ]);
}

function normalizeInstagramCrawlerItem(
  raw: unknown,
  task: CrawlerTask,
  now: string
): SourceItem | undefined {
  const item = asRecord(raw);
  const url = stringValue(item.url) || stringValue(item.inputUrl);
  const text = stringValue(item.caption) || stringValue(item.text) || stringValue(item.description);

  if (!url || !text) {
    return undefined;
  }

  const externalId =
    stringValue(item.id) || stringValue(item.shortCode) || parseInstagramShortCode(url) || url;
  const authorHandle = normalizeHandle(
    stringValue(item.ownerUsername) ||
      stringValue(item.username) ||
      stringValue(item.authorHandle) ||
      stringValue(item.author)
  );
  const publishedAt = stringValue(item.timestamp) || stringValue(item.publishedAt);

  if (task.provider === "browser_session" && (!authorHandle || !publishedAt)) {
    return undefined;
  }
  const type = stringValue(item.type).toLowerCase();

  return {
    id: `src_crawler_instagram_${safeId(externalId)}`,
    platform: "instagram",
    externalId,
    url,
    authorId: stringValue(item.authorId),
    authorName:
      stringValue(item.ownerFullName) ||
      stringValue(item.fullName) ||
      stringValue(item.authorName) ||
      authorHandle ||
      "Unknown creator",
    authorHandle,
    title: firstSentence(text) || "Instagram source",
    text,
    hashtags: normalizeHashtags(item.hashtags),
    language: "en",
    region: "unknown",
    mediaType: type === "video" || url.includes("/reel/") ? "video" : "post",
    publishedAt: publishedAt || now,
    collectedAt: now,
    metrics: {
      views:
        numberValue(item.videoViewCount) ??
        numberValue(item.videoPlayCount) ??
        numberValue(item.views),
      likes:
        numberValue(item.likesCount) ??
        numberValue(item.likeCount) ??
        numberValue(item.likes),
      comments:
        numberValue(item.commentsCount) ??
        numberValue(item.commentCount),
      shares:
        numberValue(item.sharesCount) ??
        numberValue(item.shareCount) ??
        numberValue(item.shares)
    },
    thumbnailUrl:
      stringValue(item.displayUrl) ||
      stringValue(item.thumbnailUrl) ||
      firstString(item.images),
    videoUrl: stringValue(item.videoUrl),
    embedUrl: parseInstagramShortCode(url)
      ? `https://www.instagram.com/p/${parseInstagramShortCode(url)}/embed/`
      : undefined,
    comments: normalizeComments(item.comments),
    raw: {
      source: `crawler_${task.provider}`,
      provider: task.provider,
      mode: task.mode,
      query: task.query,
      item
    },
    seeded: false
  };
}

function normalizeTikTokCrawlerItem(
  raw: unknown,
  task: CrawlerTask,
  now: string
): SourceItem | undefined {
  const item = asRecord(raw);
  const authorMeta = asRecord(item.authorMeta);
  const author = asRecord(item.author);
  const url =
    stringValue(item.webVideoUrl) ||
    stringValue(item.url) ||
    stringValue(item.videoUrl) ||
    stringValue(item.shareUrl);
  const text = stringValue(item.desc) || stringValue(item.text) || stringValue(item.caption);

  if (!url || !text) {
    return undefined;
  }

  const externalId = stringValue(item.videoId) || stringValue(item.id) || parseTikTokVideoId(url) || url;
  const authorHandle = normalizeHandle(
    stringValue(authorMeta.name) ||
      stringValue(author.uniqueId) ||
      stringValue(author.username) ||
      stringValue(item.authorHandle) ||
      stringValue(item.authorName)
  );
  const publishedAt = normalizeTikTokPublishedAt(
    stringValue(item.createTimeISO) ||
      stringValue(item.createTime) ||
      stringValue(item.publishedAt) ||
      (task.provider === "browser_session" ? publishedAtFromTikTokVideoId(url) ?? "" : ""),
    now
  );

  return {
    id: `src_crawler_tiktok_${safeId(externalId)}`,
    platform: "tiktok",
    externalId,
    url,
    authorId: stringValue(item.authorId),
    authorName:
      stringValue(authorMeta.nickName) ||
      stringValue(author.nickname) ||
      stringValue(item.authorName) ||
      stringValue(authorMeta.name) ||
      authorHandle ||
      "Unknown TikTok creator",
    authorHandle,
    title: firstSentence(text) || "TikTok source",
    text,
    hashtags: normalizeHashtags(item.hashtags),
    language: "en",
    region: "unknown",
    mediaType: "video",
    publishedAt,
    collectedAt: now,
    metrics: {
      views:
        numberValue(item.playCount) ??
        numberValue(item.viewCount) ??
        numberValue(item.views),
      likes:
        numberValue(item.diggCount) ??
        numberValue(item.likeCount) ??
        numberValue(item.likes),
      comments:
        numberValue(item.commentCount) ??
        numberValue(item.commentsCount),
      shares:
        numberValue(item.shareCount) ??
        numberValue(item.shares)
    },
    thumbnailUrl:
      firstString(item.covers) ||
      stringValue(item.coverUrl) ||
      stringValue(item.thumbnailUrl),
    videoUrl: stringValue(item.videoUrl) || stringValue(item.downloadUrl),
    comments: normalizeComments(item.comments),
    raw: {
      source: `crawler_${task.provider}`,
      provider: task.provider,
      mode: task.mode,
      query: task.query,
      item
    },
    seeded: false
  };
}

function providerStatus(status: {
  platform: CrawlerTask["platform"];
  provider: CrawlerProvider;
  status: CollectorStatus;
  message: string;
  capabilities: string[];
  missing: string[];
}): ProviderStatus {
  return status;
}

function hasProviderApiToken(
  platform: string,
  env: Readonly<Record<string, string | undefined>>
): boolean {
  return Boolean(env[`${platform.toUpperCase()}_PROVIDER_API_TOKEN`]?.trim());
}

function hasOfficialToken(
  platform: string,
  env: Readonly<Record<string, string | undefined>>
): boolean {
  return Boolean(env[`${platform.toUpperCase()}_OFFICIAL_API_TOKEN`]?.trim());
}

function normalizeQuery(value: string, mode?: CrawlerMode): string {
  const trimmed = value.trim();
  if (mode === "hashtag") {
    return trimmed.replace(/^#+/, "").trim().toLowerCase();
  }
  if (mode === "account") {
    return trimmed.replace(/^@+/, "").trim().toLowerCase();
  }
  return trimmed;
}

function clampLimit(value?: number): number {
  if (!Number.isFinite(value)) {
    return 50;
  }
  return Math.max(1, Math.min(Number(value), 500));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function firstString(value: unknown): string | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.find((entry) => typeof entry === "string" && entry.trim())?.trim();
}

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function normalizeHashtags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(
      raw
        .map((entry) => {
          if (typeof entry === "string") {
            return entry;
          }
          const record = asRecord(entry);
          return stringValue(record.name) || stringValue(record.tag);
        })
        .map((tag) => tag.trim().replace(/^#+/, "").toLowerCase())
        .filter(Boolean)
    )
  );
}

function normalizeComments(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const comments = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);

  return comments.length > 0 ? comments : undefined;
}

function firstSentence(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 96) {
    return cleaned;
  }
  return `${cleaned.slice(0, 93)}...`;
}

function parseInstagramShortCode(url: string): string | undefined {
  return url.match(/instagram\.com\/(?:p|reel)\/([^/?#]+)/i)?.[1];
}

function parseTikTokVideoId(url: string): string | undefined {
  return url.match(/\/video\/([^/?#]+)/i)?.[1];
}

function normalizeTikTokPublishedAt(value: string, fallback: string): string {
  if (!value) {
    return fallback;
  }
  if (/^\d+$/.test(value)) {
    const epochMs = Number(value) * 1000;
    return Number.isFinite(epochMs) ? new Date(epochMs).toISOString() : fallback;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function matchesKeywords(source: SourceItem, keywords: string[]): boolean {
  const normalizedText = `${source.title} ${source.text} ${source.hashtags.join(" ")}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const compactText = normalizedText.replace(/[^a-z0-9]+/g, "");
  const tokens = new Set(normalizedText.split(/\s+/).filter(Boolean));

  return keywords.some((keyword) => {
    const normalized = keyword.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const compact = normalized.replace(/[^a-z0-9]+/g, "");

    if (!normalized.includes(" ") && compact.length <= 4) {
      return tokens.has(compact);
    }

    return normalizedText.includes(normalized) || compactText.includes(compact);
  });
}

function sortSources(sources: SourceItem[], sortBy: CrawlerSortRule): SourceItem[] {
  if (sortBy === "latest") {
    return [...sources].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }

  if (sortBy === "highest_heat") {
    return [...sources].sort((a, b) => heatScore(b) - heatScore(a));
  }

  return sources;
}

function heatScore(source: SourceItem): number {
  const metrics = source.metrics;
  return (
    (metrics.views ?? 0) +
    (metrics.likes ?? 0) * 8 +
    (metrics.comments ?? 0) * 20 +
    (metrics.shares ?? 0) * 30
  );
}

function mergeBetterCrawlerSource(existing: SourceItem, incoming: SourceItem): SourceItem {
  const merged: SourceItem = {
    ...existing,
    authorName: shouldReplaceAuthorName(existing.authorName, incoming.authorName)
      ? incoming.authorName
      : existing.authorName,
    authorHandle: shouldReplaceAuthorHandle(existing.authorHandle, incoming.authorHandle)
      ? incoming.authorHandle
      : existing.authorHandle,
    authorId: existing.authorId || incoming.authorId,
    title: shouldReplaceText(existing.title, incoming.title) ? incoming.title : existing.title,
    text: shouldReplaceText(existing.text, incoming.text) ? incoming.text : existing.text,
    hashtags: existing.hashtags.length > 0 ? existing.hashtags : incoming.hashtags,
    metrics: {
      views: existing.metrics.views ?? incoming.metrics.views,
      likes: existing.metrics.likes ?? incoming.metrics.likes,
      comments: existing.metrics.comments ?? incoming.metrics.comments,
      shares: existing.metrics.shares ?? incoming.metrics.shares
    },
    thumbnailUrl: existing.thumbnailUrl || incoming.thumbnailUrl,
    videoUrl: existing.videoUrl || incoming.videoUrl,
    comments:
      existing.comments && existing.comments.length > 0
        ? existing.comments
        : incoming.comments,
    publishedAt: shouldReplacePublishedAt(existing.publishedAt, incoming.publishedAt)
      ? incoming.publishedAt
      : existing.publishedAt,
    raw: {
      ...existing.raw,
      latestCrawlerItem: incoming.raw
    },
    collectedAt: incoming.collectedAt
  };

  return JSON.stringify(merged) === JSON.stringify(existing) ? existing : merged;
}

function shouldReplaceAuthorName(existing: string, incoming: string): boolean {
  if (!incoming || isBadAuthor(existing)) {
    return Boolean(incoming && !isBadAuthor(incoming));
  }
  return false;
}

function shouldReplaceAuthorHandle(existing: string, incoming: string): boolean {
  if (!incoming || isBadAuthor(existing)) {
    return Boolean(incoming && !isBadAuthor(incoming));
  }
  return false;
}

function isBadAuthor(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return !normalized || normalized === "p" || normalized === "reel" || normalized === "unknown creator";
}

function shouldReplaceText(existing: string, incoming: string): boolean {
  const existingTrimmed = existing.trim();
  const incomingTrimmed = incoming.trim();
  if (!incomingTrimmed) {
    return false;
  }
  if (!existingTrimmed || /^https?:\/\//i.test(existingTrimmed)) {
    return true;
  }
  return incomingTrimmed.length > existingTrimmed.length * 1.4;
}

function shouldReplacePublishedAt(existing: string, incoming: string): boolean {
  if (!incoming) return false;
  const incomingTime = new Date(incoming).getTime();
  if (Number.isNaN(incomingTime)) return false;
  const existingTime = new Date(existing).getTime();
  return Number.isNaN(existingTime) || existingTime !== incomingTime;
}

function publishedAtFromTikTokVideoId(url: string): string | undefined {
  const id = parseTikTokVideoId(url);
  if (!id) return undefined;
  try {
    const seconds = Number(BigInt(id) >> BigInt(32));
    const date = new Date(seconds * 1000);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  } catch {
    return undefined;
  }
}

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function titleCase(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
