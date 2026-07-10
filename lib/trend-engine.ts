import type { Settings, SourceItem, TrendStatus, TrendTopic } from "./types";

interface Group {
  phrase: string;
  sources: SourceItem[];
}

const stopWords = new Set([
  "about",
  "across",
  "after",
  "again",
  "also",
  "and",
  "another",
  "are",
  "asking",
  "bio",
  "being",
  "breakdown",
  "building",
  "check",
  "click",
  "cinematic",
  "comment",
  "comments",
  "content",
  "drop",
  "for",
  "follow",
  "free",
  "getting",
  "more",
  "one",
  "link",
  "people",
  "please",
  "reels",
  "short",
  "subscribe",
  "that",
  "the",
  "their",
  "there",
  "these",
  "this",
  "those",
  "try",
  "trending",
  "use",
  "viral",
  "with",
  "without",
  "workflow",
  "you",
  "your"
]);

const blockedPhrases = new Set([
  "follow us",
  "link in bio",
  "full breakdown",
  "drop comment",
  "free link",
  "click link",
  "check bio",
  "viral video",
  "trending reels",
  "subscribe for",
  "comment for"
]);

export function generateTrendTopics(
  sources: SourceItem[],
  settings: Settings,
  now = new Date().toISOString()
): TrendTopic[] {
  const groups = buildRepeatedPhraseGroups(sources, settings);

  return Array.from(groups.values())
    .map((group) => buildTopic(group, settings, now))
    .sort((left, right) => right.heatScore - left.heatScore);
}

function buildRepeatedPhraseGroups(
  sources: SourceItem[],
  settings: Settings
): Map<string, Group> {
  const phraseSources = new Map<string, Map<string, SourceItem>>();
  const searchPhrases = new Set(settings.keywords.map(normalizePhrase).filter(Boolean));

  for (const source of sources) {
    for (const phrase of extractTrendPhrases(source)) {
      if (searchPhrases.has(phrase)) {
        continue;
      }
      const existing = phraseSources.get(phrase) ?? new Map<string, SourceItem>();
      existing.set(source.id, source);
      phraseSources.set(phrase, existing);
    }
  }

  const repeated = Array.from(phraseSources.entries())
    .filter(([, sourceMap]) => sourceMap.size >= 2)
    .map(([phrase, sourceMap]) => ({
      phrase,
      sources: Array.from(sourceMap.values())
    }));

  const withoutSubphrases = repeated.filter((group) => {
    const groupSourceIds = new Set(group.sources.map((source) => source.id));
    return !repeated.some((other) => {
      if (other.phrase === group.phrase || !other.phrase.includes(group.phrase)) {
        return false;
      }
      const otherSourceIds = new Set(other.sources.map((source) => source.id));
      return Array.from(groupSourceIds).every((id) => otherSourceIds.has(id));
    });
  });
  const bestBySourceSet = new Map<string, Group>();

  for (const group of withoutSubphrases) {
    const key = group.sources.map((source) => source.id).sort().join("|");
    const existing = bestBySourceSet.get(key);
    if (!existing || phraseQuality(group.phrase) > phraseQuality(existing.phrase)) {
      bestBySourceSet.set(key, group);
    }
  }

  return new Map(Array.from(bestBySourceSet.values()).map((group) => [group.phrase, group]));
}

function extractTrendPhrases(source: SourceItem): string[] {
  const text = sourceText(source);
  const phrases = new Set<string>();

  const semanticPhrase = semanticTrendPhrase(text);
  if (semanticPhrase) {
    phrases.add(semanticPhrase);
  }

  for (const segment of sourceSegments(source)) {
    const tokens = segment
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((token) => token.length > 1 && !stopWords.has(token));

    for (let size = 2; size <= 4; size += 1) {
      for (let index = 0; index <= tokens.length - size; index += 1) {
        const phrase = tokens.slice(index, index + size).join(" ");
        if (isUsefulPhrase(phrase)) {
          phrases.add(phrase);
        }
      }
    }
  }

  return Array.from(phrases);
}

function semanticTrendPhrase(text: string): string | undefined {
  const compact = text.replace(/[^a-z0-9]+/g, "");
  const hasAvatar =
    compact.includes("aiavatar") ||
    text.includes("ai avatar") ||
    text.includes("virtual presenter") ||
    text.includes("virtual presenters");
  const hasUgc =
    compact.includes("aiugc") ||
    text.includes("ugc") ||
    text.includes("user generated");
  const hasAds =
    compact.includes("aiads") ||
    text.includes("ai ads") ||
    text.includes(" ads") ||
    text.includes("advertising") ||
    text.includes("commercial");

  if (hasAvatar && hasUgc && hasAds) {
    return "ai avatar ugc ads";
  }

  return undefined;
}

function isUsefulPhrase(phrase: string): boolean {
  const words = phrase.split(" ");
  if (blockedPhrases.has(phrase)) {
    return false;
  }
  if (words.every((word) => stopWords.has(word))) {
    return false;
  }
  if (words.some((word) => word.length <= 2 && word !== "ai")) {
    return false;
  }
  if (words.join("").length < 8) {
    return false;
  }
  if (!hasSemanticAnchor(words)) {
    return false;
  }
  return true;
}

function hasSemanticAnchor(words: string[]): boolean {
  const anchors = new Set([
    "ads",
    "ai",
    "avatar",
    "demo",
    "faceless",
    "image",
    "miniature",
    "presenter",
    "product",
    "prompt",
    "runway",
    "seedance",
    "sora",
    "template",
    "text",
    "transition",
    "ugc",
    "veo",
    "video",
    "virtual",
    "workflow"
  ]);
  return words.some((word) => anchors.has(word));
}

function buildTopic(group: Group, settings: Settings, now: string): TrendTopic {
  const sortedSources = [...group.sources].sort(
    (left, right) => sourceHeat(right, now) - sourceHeat(left, now)
  );
  const topSource = sortedSources[0];
  const engagement = average(sortedSources.map((source) => engagementScore(source)));
  const freshness = average(sortedSources.map((source) => freshnessScore(source, now)));
  const repeatedSignal = Math.min(sortedSources.length / 5, 1);
  const searchContext = searchContextScore(sortedSources, settings.keywords);
  const sourceCount = Math.min(sortedSources.length / 5, 1);
  const platformBreakdown = countPlatforms(sortedSources);
  const heatScore = Math.round(
    (0.45 * engagement +
      0.25 * freshness +
      0.2 * repeatedSignal +
      0.1 * sourceCount) *
      100
  );
  const narrative = buildNarrative(group.phrase, sortedSources);

  return {
    id: `trend_${slug(group.phrase)}`,
    title: narrative.title,
    summary: narrative.summary,
    keywords: Array.from(new Set([group.phrase, ...topSource.hashtags])).slice(0, 6),
    heatScore,
    status: statusFor(heatScore, freshness),
    firstSeenAt: minDate(sortedSources.map((source) => source.publishedAt)),
    lastSeenAt: maxDate(sortedSources.map((source) => source.publishedAt)),
    sourceCount: sortedSources.length,
    platformBreakdown,
    scoreBreakdown: {
      engagement: Math.round(engagement * 100),
      freshness: Math.round(freshness * 100),
      keywordRelevance: Math.round(Math.max(repeatedSignal, searchContext) * 100),
      sourceCount: Math.round(sourceCount * 100)
    },
    sourceIds: group.sources.map((source) => source.id)
  };
}

function phraseQuality(phrase: string): number {
  const words = phrase.split(" ");
  return words.length * 100 + phrase.length;
}

function countPlatforms(sources: SourceItem[]): TrendTopic["platformBreakdown"] {
  return {
    instagram: sources.filter((source) => source.platform === "instagram").length,
    x: sources.filter((source) => source.platform === "x").length,
    tiktok: sources.filter((source) => source.platform === "tiktok").length
  };
}

function buildNarrative(
  phrase: string,
  sources: SourceItem[]
): { title: string; summary: string } {
  const sourceCount = sources.length;
  const topSource = sources[0];

  if (phrase === "ai avatar ugc ads") {
    return {
      title: "AI Avatar UGC Ads",
      summary: `${sourceCount} sources repeat AI avatar-led UGC ads signals across captions, hashtags, or comments. Representative source: ${topSource.title}.`
    };
  }

  const readablePhrase = titleCase(phrase);
  return {
    title: readablePhrase,
    summary: `${sourceCount} sources repeat "${readablePhrase}" across captions or comments. Review the evidence links to judge whether this is becoming a meaningful trend. Representative source: ${topSource.title}.`
  };
}

function sourceText(source: SourceItem): string {
  return `${source.title} ${source.text} ${source.hashtags.join(" ")} ${(source.comments ?? []).join(" ")}`
    .toLowerCase()
    .replace(/#([a-z0-9_]+)/g, "$1");
}

function sourceSegments(source: SourceItem): string[] {
  return [
    source.title,
    source.text,
    source.hashtags.join(" "),
    ...(source.comments ?? [])
  ].map((segment) => segment.toLowerCase().replace(/#([a-z0-9_]+)/g, "$1"));
}

function normalizePhrase(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.toLowerCase() === "ai") return "AI";
      if (word.toLowerCase() === "ugc") return "UGC";
      return `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

function sourceHeat(source: SourceItem, now: string): number {
  return engagementScore(source) * 0.7 + freshnessScore(source, now) * 0.3;
}

function engagementScore(source: SourceItem): number {
  const views = source.metrics.views ?? 0;
  const likes = source.metrics.likes ?? 0;
  const comments = source.metrics.comments ?? 0;
  const shares = source.metrics.shares ?? 0;
  const weighted = views + likes * 8 + comments * 20 + shares * 30;

  return Math.min(weighted / 250000, 1);
}

function freshnessScore(source: SourceItem, now: string): number {
  const ageMs = new Date(now).getTime() - new Date(source.publishedAt).getTime();
  const ageHours = Math.max(ageMs / 36e5, 0);

  if (ageHours <= 24) return 1;
  if (ageHours <= 72) return 0.65;
  if (ageHours <= 168) return 0.35;
  return 0.1;
}

function searchContextScore(sources: SourceItem[], keywords: string[]): number {
  const matched = new Set<string>();
  for (const source of sources) {
    const text = sourceText(source);
    for (const keyword of keywords) {
      if (matchesConfiguredKeywordText(text, keyword)) {
        matched.add(keyword);
      }
    }
  }
  return Math.min(matched.size / 3, 1);
}

export function matchesConfiguredKeywordText(text: string, keyword: string): boolean {
  const tokens = normalizePhrase(text).split(/\s+/).filter(Boolean);
  const keywordTokens = normalizePhrase(keyword).split(/\s+/).filter(Boolean);

  if (keywordTokens.length === 0) {
    return false;
  }

  for (let index = 0; index <= tokens.length - keywordTokens.length; index += 1) {
    const matches = keywordTokens.every(
      (token, tokenIndex) => tokens[index + tokenIndex] === token
    );
    if (matches) {
      return true;
    }
  }

  return false;
}

function statusFor(heatScore: number, freshness: number): TrendStatus {
  if (heatScore >= 70) return "hot";
  if (freshness >= 0.75 && heatScore >= 40) return "emerging";
  if (freshness < 0.4) return "cooling";
  return "stable";
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function minDate(values: string[]): string {
  return new Date(Math.min(...values.map((value) => new Date(value).getTime()))).toISOString();
}

function maxDate(values: string[]): string {
  return new Date(Math.max(...values.map((value) => new Date(value).getTime()))).toISOString();
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
