import { normalizeCrawlerItemForSource } from "./crawler";
import type {
  CollectionCandidate,
  CollectionCandidateFilters,
  CollectionCandidatePatch,
  CollectionPromotionResult,
  CrawlerTask,
  SourceItem
} from "./types";

export function buildCollectionCandidates({
  task,
  existingCandidates,
  existingSources,
  keywords,
  minLikes,
  now
}: {
  task: CrawlerTask;
  existingCandidates: CollectionCandidate[];
  existingSources: SourceItem[];
  keywords: string[];
  minLikes: number;
  now: string;
}): { candidates: CollectionCandidate[]; invalid: number } {
  const knownByUrl = new Map<string, string>();
  const knownByExternalId = new Map<string, string>();

  for (const candidate of existingCandidates) {
    knownByUrl.set(candidate.source.url, candidate.id);
    knownByExternalId.set(candidate.source.externalId, candidate.id);
  }

  for (const source of existingSources) {
    knownByUrl.set(source.url, source.id);
    knownByExternalId.set(source.externalId, source.id);
  }

  const candidates: CollectionCandidate[] = [];
  let invalid = 0;

  for (const raw of task.items ?? []) {
    const source = normalizeCrawlerItemForSource({ raw, task, now });
    if (!source) {
      invalid += 1;
      continue;
    }

    const duplicateOf =
      knownByUrl.get(source.url) || knownByExternalId.get(source.externalId);
    const matchedKeywords = matchedConfiguredKeywords(source, keywords);
    const candidate: CollectionCandidate = {
      id: `cand_${source.id}`,
      status: duplicateOf ? "duplicate" : "pending",
      source,
      seed: {
        platform: task.platform,
        mode: task.mode,
        query: task.query,
        provider: task.provider
      },
      review: {
        keywordMatched: matchedKeywords.length > 0,
        matchedKeywords,
        belowMinLikes:
          source.metrics.likes !== undefined && source.metrics.likes < minLikes,
        duplicateOf,
        duplicateGroup: duplicateOf ? `dup_${safeId(duplicateOf)}` : undefined,
        candidatePhrases: extractCandidatePhrases(source, keywords)
      },
      createdAt: now,
      updatedAt: now
    };

    knownByUrl.set(source.url, candidate.id);
    knownByExternalId.set(source.externalId, candidate.id);
    candidates.push(candidate);
  }

  return { candidates, invalid };
}

export function matchedConfiguredKeywords(
  source: SourceItem,
  keywords: string[]
): string[] {
  const text = searchableText(source);
  const tokens = text.split(/\s+/).filter(Boolean);

  return keywords.filter((keyword) => {
    const normalized = normalizePhrase(keyword);
    return Boolean(normalized && phraseMatchesTokens(tokens, normalized));
  });
}

export function extractCandidatePhrases(
  source: SourceItem,
  keywords: string[]
): string[] {
  const keywordSet = new Set(keywords.map(normalizePhrase).filter(Boolean));
  const tokens = searchableText(source)
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !genericWords.has(token));
  const phrases = new Set<string>();

  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const phrase = tokens.slice(index, index + size).join(" ");
      if (!keywordSet.has(phrase) && isCandidatePhrase(phrase)) {
        phrases.add(phrase);
      }
    }
  }

  return Array.from(phrases).slice(0, 8);
}

export function applyCandidatePatch(
  candidates: CollectionCandidate[],
  patch: CollectionCandidatePatch,
  now: string
): CollectionCandidate[] {
  const ids = new Set(patch.ids);

  return candidates.map((candidate) => {
    if (!ids.has(candidate.id)) return candidate;

    return {
      ...candidate,
      status: patch.status ?? candidate.status,
      source: {
        ...candidate.source,
        ...patch.fields,
        metrics: patch.fields?.metrics ?? candidate.source.metrics
      },
      review: {
        ...candidate.review,
        duplicateOf: patch.duplicateOf ?? candidate.review.duplicateOf,
        duplicateGroup:
          patch.duplicateOf !== undefined
            ? `dup_${safeId(patch.duplicateOf)}`
            : candidate.review.duplicateGroup,
        candidatePhrases:
          patch.candidatePhrases ?? candidate.review.candidatePhrases
      },
      updatedAt: now
    };
  });
}

export function deleteCollectionCandidates(
  candidates: CollectionCandidate[],
  ids: string[]
): CollectionCandidate[] {
  const deleteIds = new Set(ids);
  return candidates.filter((candidate) => !deleteIds.has(candidate.id));
}

export function filterCollectionCandidates(
  candidates: CollectionCandidate[],
  filters: CollectionCandidateFilters
): CollectionCandidate[] {
  return candidates.filter((candidate) => {
    if (
      filters.platform &&
      filters.platform !== "all" &&
      candidate.source.platform !== filters.platform
    ) {
      return false;
    }
    if (
      filters.status &&
      filters.status !== "all" &&
      candidate.status !== filters.status
    ) {
      return false;
    }
    if (filters.keywordMatched === "matched" && !candidate.review.keywordMatched) {
      return false;
    }
    if (filters.keywordMatched === "unmatched" && candidate.review.keywordMatched) {
      return false;
    }
    if (
      filters.seedMode &&
      filters.seedMode !== "all" &&
      candidate.seed.mode !== filters.seedMode
    ) {
      return false;
    }
    if (
      filters.seedQuery &&
      !candidate.seed.query.toLowerCase().includes(filters.seedQuery.toLowerCase())
    ) {
      return false;
    }
    if (
      filters.minLikes !== undefined &&
      (candidate.source.metrics.likes ?? 0) < filters.minLikes
    ) {
      return false;
    }
    if (
      filters.duplicateGroup &&
      candidate.review.duplicateGroup !== filters.duplicateGroup
    ) {
      return false;
    }
    if (
      filters.dateFrom &&
      new Date(candidate.source.publishedAt).getTime() <
        new Date(filters.dateFrom).getTime()
    ) {
      return false;
    }
    if (
      filters.dateTo &&
      new Date(candidate.source.publishedAt).getTime() >
        new Date(filters.dateTo).getTime()
    ) {
      return false;
    }
    return true;
  });
}

export function promoteApprovedCandidates({
  candidates,
  existingSources,
  now
}: {
  candidates: CollectionCandidate[];
  existingSources: SourceItem[];
  now: string;
}): CollectionPromotionResult & { remainingCandidates: CollectionCandidate[] } {
  const existingByUrl = new Map(existingSources.map((source) => [source.url, source]));
  const existingByExternalId = new Map(
    existingSources.map((source) => [source.externalId, source])
  );
  const promoted: SourceItem[] = [];
  const updated: SourceItem[] = [];
  const completedCandidateIds = new Set<string>();
  let skipped = 0;

  for (const candidate of candidates) {
    if (candidate.status !== "approved") continue;
    if (
      candidate.review.belowMinLikes ||
      candidate.review.duplicateOf
    ) {
      skipped += 1;
      continue;
    }

    const source = { ...candidate.source, collectedAt: now };
    const duplicate =
      existingByUrl.get(source.url) || existingByExternalId.get(source.externalId);
    if (duplicate) {
      updated.push({ ...duplicate, ...source, id: duplicate.id });
    } else {
      promoted.push(source);
      existingByUrl.set(source.url, source);
      existingByExternalId.set(source.externalId, source);
    }
    completedCandidateIds.add(candidate.id);
  }

  return {
    promoted,
    updated,
    skipped,
    remainingCandidates: candidates.filter(
      (candidate) => !completedCandidateIds.has(candidate.id)
    )
  };
}

const genericWords = new Set([
  "bio",
  "breakdown",
  "check",
  "click",
  "comment",
  "comments",
  "drop",
  "follow",
  "following",
  "free",
  "full",
  "like",
  "likes",
  "link",
  "reels",
  "subscribe",
  "trending",
  "video",
  "viral"
]);

function isCandidatePhrase(phrase: string): boolean {
  if (phrase.replace(/\s+/g, "").length < 8) return false;
  const blocked = [
    "follow us",
    "link in bio",
    "full breakdown",
    "drop comment",
    "free link",
    "click link",
    "check bio",
    "viral video",
    "trending reels"
  ];
  return !blocked.includes(phrase);
}

function searchableText(source: SourceItem): string {
  return `${source.title} ${source.text} ${source.hashtags.join(" ")} ${(source.comments ?? []).join(" ")}`
    .toLowerCase()
    .replace(/#([a-z0-9_]+)/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizePhrase(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function phraseMatchesTokens(tokens: string[], phrase: string): boolean {
  const phraseTokens = phrase.split(/\s+/).filter(Boolean);
  if (phraseTokens.length === 0) {
    return false;
  }

  for (let index = 0; index <= tokens.length - phraseTokens.length; index += 1) {
    const matches = phraseTokens.every(
      (token, tokenIndex) => tokens[index + tokenIndex] === token
    );
    if (matches) {
      return true;
    }
  }

  return false;
}

function safeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
