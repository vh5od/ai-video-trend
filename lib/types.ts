export type Platform = "instagram" | "x" | "tiktok";

export type TrendStatus = "emerging" | "hot" | "stable" | "cooling";

export type CollectorStatus = "not_configured" | "ready" | "partial" | "failed";

export type CrawlerMode = "hashtag" | "keyword" | "account";

export type CrawlerProvider =
  | "manual_import"
  | "provider_api"
  | "official_api"
  | "browser_session";

export type CrawlerSortRule = "as_provided" | "latest" | "highest_heat";

export interface SourceMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

export interface SourceItem {
  id: string;
  platform: Platform;
  externalId: string;
  url: string;
  authorId?: string;
  authorName: string;
  authorHandle: string;
  title: string;
  text: string;
  hashtags: string[];
  language: string;
  region: string;
  mediaType: "reel" | "post" | "video";
  publishedAt: string;
  collectedAt: string;
  metrics: SourceMetrics;
  thumbnailUrl?: string;
  videoUrl?: string;
  embedUrl?: string;
  comments?: string[];
  raw: Record<string, unknown>;
  seeded: boolean;
}

export type CollectionCandidateStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "duplicate";

export interface CollectionCandidate {
  id: string;
  status: CollectionCandidateStatus;
  source: SourceItem;
  seed: {
    platform: Extract<Platform, "instagram" | "tiktok">;
    mode: CrawlerMode;
    query: string;
    provider: CrawlerProvider;
  };
  review: {
    keywordMatched: boolean;
    matchedKeywords: string[];
    belowMinLikes: boolean;
    duplicateOf?: string;
    duplicateGroup?: string;
    candidatePhrases: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface CollectionCandidateFilters {
  platform?: Platform | "all";
  status?: CollectionCandidateStatus | "all";
  keywordMatched?: "all" | "matched" | "unmatched";
  seedMode?: CrawlerMode | "all";
  seedQuery?: string;
  minLikes?: number;
  dateFrom?: string;
  dateTo?: string;
  duplicateGroup?: string;
}

export interface CollectionCandidatePatch {
  ids: string[];
  status?: CollectionCandidateStatus;
  fields?: Partial<
    Pick<
      SourceItem,
      | "title"
      | "text"
      | "authorName"
      | "authorHandle"
      | "publishedAt"
      | "metrics"
    >
  >;
  candidatePhrases?: string[];
  duplicateOf?: string;
}

export interface CollectionPromotionResult {
  promoted: SourceItem[];
  updated: SourceItem[];
  skipped: number;
}

export interface TrendTopic {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
  heatScore: number;
  status: TrendStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  sourceCount: number;
  platformBreakdown: Record<Platform, number>;
  scoreBreakdown: {
    engagement: number;
    freshness: number;
    keywordRelevance: number;
    sourceCount: number;
  };
  sourceIds: string[];
}

export interface CollectionRun {
  id: string;
  platform: Platform;
  provider: string;
  status: CollectorStatus;
  startedAt: string;
  finishedAt: string;
  itemsFound: number;
  itemsStored: number;
  message: string;
  errorCode?: string;
}

export interface Settings {
  instagramHashtags: string[];
  instagramCreators: string[];
  tiktokHashtags: string[];
  tiktokCreators: string[];
  keywords: string[];
  dailyCrawlLimit: number;
  hashtagCrawlLimit?: number;
  creatorCrawlLimit?: number;
  commentsPerVideo: number;
  minLikes: number;
  refreshSchedule: string;
}

export interface ProviderStatus {
  platform: Platform;
  provider: string;
  status: CollectorStatus;
  message: string;
  capabilities: string[];
  missing: string[];
}

export interface CrawlerTaskInput {
  platform?: Platform;
  mode?: CrawlerMode;
  query?: string;
  provider?: CrawlerProvider;
  limit?: number;
  sortBy?: CrawlerSortRule;
  items?: unknown[];
  filterToKeywords?: boolean;
}

export interface CrawlerTask {
  platform: Extract<Platform, "instagram" | "tiktok">;
  mode: CrawlerMode;
  query: string;
  provider: CrawlerProvider;
  limit: number;
  sortBy: CrawlerSortRule;
  items?: unknown[];
  filterToKeywords: boolean;
}

export interface CrawlerValidationResult {
  valid: boolean;
  errors: string[];
  task?: CrawlerTask;
}

export interface CrawlerImportResult {
  imported: SourceItem[];
  updated: SourceItem[];
  skippedDuplicates: number;
  skippedUnmatched: number;
  skippedBelowMinLikes: number;
  skippedInvalid: number;
  itemsFound: number;
}
