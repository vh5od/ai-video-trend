import type { SourceItem } from "./types";

interface XPublicMetrics {
  like_count?: number;
  retweet_count?: number;
  reply_count?: number;
  quote_count?: number;
  impression_count?: number;
}

interface XTweet {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  entities?: {
    hashtags?: Array<{ tag: string }>;
  };
  public_metrics?: XPublicMetrics;
}

interface XUser {
  id: string;
  username?: string;
  name?: string;
}

interface XSearchResponse {
  data?: XTweet[];
  includes?: {
    users?: XUser[];
  };
  meta?: Record<string, unknown>;
}

export interface CollectXRecentSearchInput {
  token: string;
  queries: string[];
  maxResults?: number;
  now?: string;
  fetchImpl?: typeof fetch;
}

export interface CollectXRecentSearchResult {
  sources: SourceItem[];
  raw: XSearchResponse[];
}

export async function collectXRecentSearch({
  token,
  queries,
  maxResults = 10,
  now = new Date().toISOString(),
  fetchImpl = fetch
}: CollectXRecentSearchInput): Promise<CollectXRecentSearchResult> {
  const raw: XSearchResponse[] = [];
  const sources: SourceItem[] = [];
  const seen = new Set<string>();

  for (const query of queries.filter(Boolean)) {
    const url = buildRecentSearchUrl(query, maxResults);
    const response = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`X recent search failed with HTTP ${response.status}.`);
    }

    const json = (await response.json()) as XSearchResponse;
    raw.push(json);
    const users = new Map(
      (json.includes?.users ?? []).map((user) => [user.id, user] as const)
    );

    for (const tweet of json.data ?? []) {
      if (seen.has(tweet.id)) {
        continue;
      }
      seen.add(tweet.id);
      sources.push(normalizeXTweet(tweet, users, now));
    }
  }

  return { sources, raw };
}

export function normalizeXTweet(
  tweet: XTweet,
  users: Map<string, XUser>,
  now = new Date().toISOString()
): SourceItem {
  const user = tweet.author_id ? users.get(tweet.author_id) : undefined;
  const username = user?.username || "unknown";
  const metrics = tweet.public_metrics ?? {};

  return {
    id: `src_x_${tweet.id}`,
    platform: "x",
    externalId: tweet.id,
    url: `https://x.com/${username}/status/${tweet.id}`,
    authorName: user?.name || username,
    authorHandle: username,
    title: tweet.text.slice(0, 72),
    text: tweet.text,
    hashtags: (tweet.entities?.hashtags ?? []).map((tag) => tag.tag.toLowerCase()),
    language: "en",
    region: "unknown",
    mediaType: "post",
    publishedAt: tweet.created_at || now,
    collectedAt: now,
    metrics: {
      views: metrics.impression_count,
      likes: metrics.like_count,
      comments: metrics.reply_count,
      shares: (metrics.retweet_count ?? 0) + (metrics.quote_count ?? 0)
    },
    raw: {
      source: "x_recent_search",
      tweet
    },
    seeded: false
  };
}

function buildRecentSearchUrl(query: string, maxResults: number): string {
  const params = new URLSearchParams({
    query,
    max_results: String(Math.max(10, Math.min(maxResults, 100))),
    "tweet.fields": "created_at,public_metrics,entities,lang,author_id",
    expansions: "author_id",
    "user.fields": "username,name"
  });

  return `https://api.x.com/2/tweets/search/recent?${params.toString()}`;
}
