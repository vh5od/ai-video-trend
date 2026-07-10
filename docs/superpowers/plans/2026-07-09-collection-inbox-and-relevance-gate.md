# Collection Inbox and Relevance Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reviewable collection inbox so crawled Instagram/TikTok items are cleaned, deduplicated, and approved before entering the dashboard and trend engine.

**Architecture:** Add a file-backed `CollectionCandidate` layer alongside the existing `SourceItem` approved evidence layer. Crawl APIs write candidates first; inbox APIs update candidate state and promote approved candidates into `source-items.json`; dashboard and trend engine continue reading approved sources only.

**Tech Stack:** Next.js App Router, TypeScript, React client components, file-backed JSON data store, Vitest.

---

## File Structure

- Modify `lib/types.ts`: add `CollectionCandidate`, candidate statuses, filters, batch update input, and promotion result types.
- Modify `lib/data-store.ts`: add `readCollectionCandidates()` and `writeCollectionCandidates()` for `data/collection-candidates.json`.
- Create `lib/collection-candidates.ts`: normalize crawler output into candidates, compute keyword matches, detect duplicates, update statuses/fields, delete candidates, and promote approved candidates to source items.
- Modify `lib/crawler.ts`: keep existing source normalization helpers but expose candidate-friendly normalization through `importCrawlerItems` or new exported helpers.
- Modify `app/api/crawler/run/route.ts`: write crawled/manual items to candidates, not directly to source items.
- Modify `app/api/crawl/daily/route.ts`: write daily crawled items to candidates, not directly to source items.
- Create `app/api/collection/candidates/route.ts`: list, patch, and delete collection candidates.
- Create `app/api/collection/promote/route.ts`: promote approved candidates into `source-items.json` and regenerate trends.
- Modify `app/api/collection/status/route.ts`: include candidate counts by status.
- Modify `app/collection/page.tsx`: replace source-only collection display with dense candidate inbox table and promotion controls.
- Modify `lib/trend-engine.ts`: strengthen phrase filtering for generic engagement and marketing phrases.
- Add tests in `test/collection-candidates.test.ts`.
- Update tests in `test/crawler.test.ts`, `test/daily-crawl.test.ts`, and `test/trend-engine.test.ts`.

---

### Task 1: Candidate Types and Store

**Files:**
- Modify: `D:\2026Q2\AI VIDEO TREND\lib\types.ts`
- Modify: `D:\2026Q2\AI VIDEO TREND\lib\data-store.ts`
- Test: `D:\2026Q2\AI VIDEO TREND\test\collection-candidates.test.ts`

- [ ] **Step 1: Write the failing test**

Add `test/collection-candidates.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { CollectionCandidate, SourceItem } from "@/lib/types";

describe("collection candidate types", () => {
  test("supports pending review metadata before promotion", () => {
    const candidate: CollectionCandidate = {
      id: "cand_instagram_abc",
      status: "pending",
      source: {
        id: "src_crawler_instagram_abc",
        platform: "instagram",
        externalId: "abc",
        url: "https://www.instagram.com/reel/abc/",
        authorName: "Creator",
        authorHandle: "creator",
        title: "AI product avatar demo",
        text: "AI product avatar demo",
        hashtags: ["aivideo"],
        language: "en",
        region: "unknown",
        mediaType: "video",
        publishedAt: "2026-07-09T00:00:00.000Z",
        collectedAt: "2026-07-09T01:00:00.000Z",
        metrics: { likes: 1200 },
        raw: {},
        seeded: false
      } satisfies SourceItem,
      seed: {
        platform: "instagram",
        mode: "hashtag",
        query: "aivideo",
        provider: "browser_session"
      },
      review: {
        keywordMatched: true,
        matchedKeywords: ["AI avatar"],
        belowMinLikes: false,
        duplicateOf: undefined,
        candidatePhrases: ["product avatar demo"]
      },
      createdAt: "2026-07-09T01:00:00.000Z",
      updatedAt: "2026-07-09T01:00:00.000Z"
    };

    expect(candidate.status).toBe("pending");
    expect(candidate.review.keywordMatched).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd test -- test/collection-candidates.test.ts`

Expected: TypeScript/Vitest fails because `CollectionCandidate` is not exported from `lib/types.ts`.

- [ ] **Step 3: Add candidate types**

In `lib/types.ts`, add:

```ts
export type CollectionCandidateStatus = "pending" | "approved" | "rejected" | "duplicate";

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
  fields?: Partial<Pick<SourceItem, "title" | "text" | "authorName" | "authorHandle" | "publishedAt" | "metrics">>;
  candidatePhrases?: string[];
  duplicateOf?: string;
}

export interface CollectionPromotionResult {
  promoted: SourceItem[];
  updated: SourceItem[];
  skipped: number;
}
```

- [ ] **Step 4: Add data-store read/write helpers**

In `lib/data-store.ts`, update import:

```ts
import type { CollectionCandidate, CollectionRun, Settings, SourceItem, TrendTopic } from "./types";
```

Add:

```ts
export function readCollectionCandidates(): Promise<CollectionCandidate[]> {
  return readJson<CollectionCandidate[]>("collection-candidates.json", []);
}

export function writeCollectionCandidates(candidates: CollectionCandidate[]): Promise<void> {
  return writeJson("collection-candidates.json", candidates);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm.cmd test -- test/collection-candidates.test.ts`

Expected: PASS.

---

### Task 2: Candidate Creation, Review Metadata, and Duplicate Detection

**Files:**
- Create: `D:\2026Q2\AI VIDEO TREND\lib\collection-candidates.ts`
- Modify: `D:\2026Q2\AI VIDEO TREND\lib\crawler.ts`
- Test: `D:\2026Q2\AI VIDEO TREND\test\collection-candidates.test.ts`

- [ ] **Step 1: Write failing tests for candidate creation**

Append to `test/collection-candidates.test.ts`:

```ts
import { buildCollectionCandidates } from "@/lib/collection-candidates";
import type { CrawlerTask } from "@/lib/types";

const task: CrawlerTask = {
  platform: "instagram",
  mode: "hashtag",
  query: "aivideo",
  provider: "manual_import",
  limit: 50,
  sortBy: "latest",
  filterToKeywords: true,
  items: [
    {
      id: "abc",
      url: "https://www.instagram.com/reel/abc/",
      text: "AI avatar product demo with talking presenter",
      authorHandle: "creator",
      publishedAt: "2026-07-09T00:00:00.000Z",
      likes: 1200
    },
    {
      id: "offtopic",
      url: "https://www.instagram.com/reel/offtopic/",
      text: "Empire building motivation reel",
      authorHandle: "coach",
      publishedAt: "2026-07-09T00:00:00.000Z",
      likes: 5000
    }
  ]
};

describe("collection candidate builder", () => {
  test("stores crawled items as pending candidates with keyword metadata", () => {
    const result = buildCollectionCandidates({
      task,
      existingCandidates: [],
      existingSources: [],
      keywords: ["AI avatar"],
      minLikes: 1000,
      now: "2026-07-09T01:00:00.000Z"
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]).toMatchObject({
      status: "pending",
      review: {
        keywordMatched: true,
        matchedKeywords: ["AI avatar"],
        belowMinLikes: false
      }
    });
    expect(result.candidates[1]).toMatchObject({
      status: "pending",
      review: {
        keywordMatched: false,
        matchedKeywords: [],
        belowMinLikes: false
      }
    });
  });

  test("marks duplicate candidates instead of creating dashboard sources", () => {
    const existing = buildCollectionCandidates({
      task,
      existingCandidates: [],
      existingSources: [],
      keywords: ["AI avatar"],
      minLikes: 1000,
      now: "2026-07-09T01:00:00.000Z"
    }).candidates;

    const result = buildCollectionCandidates({
      task,
      existingCandidates: existing,
      existingSources: [],
      keywords: ["AI avatar"],
      minLikes: 1000,
      now: "2026-07-09T02:00:00.000Z"
    });

    expect(result.candidates[0].status).toBe("duplicate");
    expect(result.candidates[0].review.duplicateOf).toBe(existing[0].id);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm.cmd test -- test/collection-candidates.test.ts`

Expected: FAIL because `lib/collection-candidates.ts` does not exist.

- [ ] **Step 3: Export normalization from crawler**

In `lib/crawler.ts`, add a new exported helper next to `importCrawlerItems`:

```ts
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
```

- [ ] **Step 4: Implement candidate builder**

Create `lib/collection-candidates.ts`:

```ts
import { normalizeCrawlerItemForSource } from "./crawler";
import type {
  CollectionCandidate,
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

    const duplicateOf = knownByUrl.get(source.url) || knownByExternalId.get(source.externalId);
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

export function matchedConfiguredKeywords(source: SourceItem, keywords: string[]): string[] {
  const text = searchableText(source);
  const compactText = text.replace(/[^a-z0-9]+/g, "");
  return keywords.filter((keyword) => {
    const normalized = normalizePhrase(keyword);
    const compact = normalized.replace(/[^a-z0-9]+/g, "");
    return Boolean(normalized && (text.includes(normalized) || compactText.includes(compact)));
  });
}

export function extractCandidatePhrases(source: SourceItem, keywords: string[]): string[] {
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

const genericWords = new Set([
  "comment",
  "comments",
  "subscribe",
  "follow",
  "following",
  "like",
  "likes",
  "link",
  "bio",
  "viral",
  "video",
  "reels",
  "trending",
  "full",
  "breakdown",
  "click",
  "free",
  "drop",
  "check"
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

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
```

- [ ] **Step 5: Run candidate tests**

Run: `npm.cmd test -- test/collection-candidates.test.ts`

Expected: PASS.

---

### Task 3: Candidate Updates, Deletion, and Promotion

**Files:**
- Modify: `D:\2026Q2\AI VIDEO TREND\lib\collection-candidates.ts`
- Test: `D:\2026Q2\AI VIDEO TREND\test\collection-candidates.test.ts`

- [ ] **Step 1: Write failing tests for review actions**

Append:

```ts
import {
  applyCandidatePatch,
  deleteCollectionCandidates,
  promoteApprovedCandidates
} from "@/lib/collection-candidates";

describe("collection candidate review actions", () => {
  test("approves selected candidates and edits text fields", () => {
    const built = buildCollectionCandidates({
      task,
      existingCandidates: [],
      existingSources: [],
      keywords: ["AI avatar"],
      minLikes: 1000,
      now: "2026-07-09T01:00:00.000Z"
    }).candidates;

    const next = applyCandidatePatch(built, {
      ids: [built[0].id],
      status: "approved",
      fields: { title: "Edited title" },
      candidatePhrases: ["talking product avatar"]
    }, "2026-07-09T02:00:00.000Z");

    expect(next[0].status).toBe("approved");
    expect(next[0].source.title).toBe("Edited title");
    expect(next[0].review.candidatePhrases).toEqual(["talking product avatar"]);
  });

  test("deletes selected candidates", () => {
    const built = buildCollectionCandidates({
      task,
      existingCandidates: [],
      existingSources: [],
      keywords: ["AI avatar"],
      minLikes: 1000,
      now: "2026-07-09T01:00:00.000Z"
    }).candidates;

    expect(deleteCollectionCandidates(built, [built[0].id])).toHaveLength(1);
  });

  test("promotes approved keyword-matched candidates into sources", () => {
    const built = buildCollectionCandidates({
      task,
      existingCandidates: [],
      existingSources: [],
      keywords: ["AI avatar"],
      minLikes: 1000,
      now: "2026-07-09T01:00:00.000Z"
    }).candidates;
    const approved = applyCandidatePatch(built, {
      ids: [built[0].id],
      status: "approved"
    }, "2026-07-09T02:00:00.000Z");

    const result = promoteApprovedCandidates({
      candidates: approved,
      existingSources: [],
      now: "2026-07-09T03:00:00.000Z"
    });

    expect(result.promoted).toHaveLength(1);
    expect(result.remainingCandidates.find((candidate) => candidate.id === built[0].id)?.status).toBe("approved");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm.cmd test -- test/collection-candidates.test.ts`

Expected: FAIL because review action functions are not exported.

- [ ] **Step 3: Implement review actions**

Add to `lib/collection-candidates.ts`:

```ts
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
        candidatePhrases: patch.candidatePhrases ?? candidate.review.candidatePhrases
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
  const existingByExternalId = new Map(existingSources.map((source) => [source.externalId, source]));
  const promoted: SourceItem[] = [];
  const updated: SourceItem[] = [];
  let skipped = 0;

  for (const candidate of candidates) {
    if (candidate.status !== "approved") continue;
    if (!candidate.review.keywordMatched || candidate.review.belowMinLikes || candidate.review.duplicateOf) {
      skipped += 1;
      continue;
    }
    const source = { ...candidate.source, collectedAt: now };
    const duplicate = existingByUrl.get(source.url) || existingByExternalId.get(source.externalId);
    if (duplicate) {
      updated.push({ ...duplicate, ...source, id: duplicate.id });
    } else {
      promoted.push(source);
      existingByUrl.set(source.url, source);
      existingByExternalId.set(source.externalId, source);
    }
  }

  return {
    promoted,
    updated,
    skipped,
    remainingCandidates: candidates
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm.cmd test -- test/collection-candidates.test.ts`

Expected: PASS.

---

### Task 4: Crawl APIs Write Candidates First

**Files:**
- Modify: `D:\2026Q2\AI VIDEO TREND\app\api\crawler\run\route.ts`
- Modify: `D:\2026Q2\AI VIDEO TREND\app\api\crawl\daily\route.ts`
- Test: `D:\2026Q2\AI VIDEO TREND\test\crawler.test.ts`
- Test: `D:\2026Q2\AI VIDEO TREND\test\daily-crawl.test.ts`

- [ ] **Step 1: Add route-level behavior tests if existing route tests are absent**

If route tests are hard to isolate, add unit tests to `test/collection-candidates.test.ts` that cover `buildCollectionCandidates()` as the API's core behavior:

```ts
test("manual crawler imports produce candidates instead of sources", () => {
  const result = buildCollectionCandidates({
    task,
    existingCandidates: [],
    existingSources: [],
    keywords: ["AI avatar"],
    minLikes: 0,
    now: "2026-07-09T01:00:00.000Z"
  });

  expect(result.candidates.every((candidate) => candidate.status === "pending")).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it passes with helper and protects API refactor**

Run: `npm.cmd test -- test/collection-candidates.test.ts`

Expected: PASS.

- [ ] **Step 3: Refactor `app/api/crawler/run/route.ts`**

Replace direct `importCrawlerItems()` usage with:

```ts
const [sources, candidates, settings, runs] = await Promise.all([
  readSourceItems(),
  readCollectionCandidates(),
  readSettings(),
  readCollectionRuns()
]);
```

After browser/manual items are available:

```ts
const result = buildCollectionCandidates({
  task,
  existingCandidates: candidates,
  existingSources: sources,
  keywords: settings.keywords,
  minLikes: settings.minLikes,
  now
});
const nextCandidates = [...result.candidates, ...candidates];
const run = buildRun({
  id: `run_crawler_${Date.now()}`,
  task,
  now,
  itemsFound: task.items?.length ?? 0,
  itemsStored: result.candidates.length,
  status: "ready",
  message: `Collected ${result.candidates.length} ${task.platform} candidates for ${task.mode} "${task.query}". Review and approve them in Collection Inbox before they enter the dashboard. Skipped ${result.invalid} invalid records.`
});

await Promise.all([
  writeCollectionCandidates(nextCandidates),
  writeCollectionRuns([run, ...runs])
]);

return NextResponse.json({ candidates: result.candidates, invalid: result.invalid, run });
```

Import these helpers:

```ts
import { buildCollectionCandidates } from "@/lib/collection-candidates";
import { readCollectionCandidates, writeCollectionCandidates } from "@/lib/data-store";
```

Remove `applyCrawlerItemUpdates`, `importCrawlerItems`, `writeSourceItems`, `writeTrendTopics`, and `generateTrendTopics` imports from this route.

- [ ] **Step 4: Refactor `app/api/crawl/daily/route.ts`**

Read candidates:

```ts
const [existingSources, existingCandidates, existingRuns] = await Promise.all([
  readSourceItems(),
  readCollectionCandidates(),
  readCollectionRuns()
]);
let nextCandidates = existingCandidates;
```

Inside each task:

```ts
const result = buildCollectionCandidates({
  task: { ...task, items: browserResult.items },
  existingCandidates: nextCandidates,
  existingSources,
  keywords: settings.keywords,
  minLikes: settings.minLikes,
  now
});
nextCandidates = [...result.candidates, ...nextCandidates];
itemsFound += browserResult.items.length;
itemsStored += result.candidates.length;
```

Write only candidates and runs:

```ts
await Promise.all([
  writeCollectionCandidates(nextCandidates),
  writeCollectionRuns([...runs, ...existingRuns])
]);
```

Return message should say candidates were stored for review, not dashboard sources.

- [ ] **Step 5: Run affected tests**

Run:

```powershell
npm.cmd test -- test/collection-candidates.test.ts test/crawler.test.ts test/daily-crawl.test.ts
```

Expected: PASS after updating any assertions that expected immediate source storage.

---

### Task 5: Candidate Inbox APIs

**Files:**
- Create: `D:\2026Q2\AI VIDEO TREND\app\api\collection\candidates\route.ts`
- Create: `D:\2026Q2\AI VIDEO TREND\app\api\collection\promote\route.ts`
- Modify: `D:\2026Q2\AI VIDEO TREND\app\api\collection\status\route.ts`
- Test: `D:\2026Q2\AI VIDEO TREND\test\collection-candidates.test.ts`

- [ ] **Step 1: Add filtering tests**

Append:

```ts
import { filterCollectionCandidates } from "@/lib/collection-candidates";

test("filters candidates by status and keyword match", () => {
  const built = buildCollectionCandidates({
    task,
    existingCandidates: [],
    existingSources: [],
    keywords: ["AI avatar"],
    minLikes: 1000,
    now: "2026-07-09T01:00:00.000Z"
  }).candidates;
  const approved = applyCandidatePatch(built, {
    ids: [built[0].id],
    status: "approved"
  }, "2026-07-09T02:00:00.000Z");

  expect(filterCollectionCandidates(approved, { status: "approved" })).toHaveLength(1);
  expect(filterCollectionCandidates(approved, { keywordMatched: "unmatched" })).toHaveLength(1);
});
```

- [ ] **Step 2: Implement `filterCollectionCandidates`**

Add to `lib/collection-candidates.ts`:

```ts
export function filterCollectionCandidates(
  candidates: CollectionCandidate[],
  filters: CollectionCandidateFilters
): CollectionCandidate[] {
  return candidates.filter((candidate) => {
    if (filters.platform && filters.platform !== "all" && candidate.source.platform !== filters.platform) return false;
    if (filters.status && filters.status !== "all" && candidate.status !== filters.status) return false;
    if (filters.keywordMatched === "matched" && !candidate.review.keywordMatched) return false;
    if (filters.keywordMatched === "unmatched" && candidate.review.keywordMatched) return false;
    if (filters.seedMode && filters.seedMode !== "all" && candidate.seed.mode !== filters.seedMode) return false;
    if (filters.seedQuery && !candidate.seed.query.includes(filters.seedQuery.toLowerCase())) return false;
    if (filters.minLikes !== undefined && (candidate.source.metrics.likes ?? 0) < filters.minLikes) return false;
    if (filters.duplicateGroup && candidate.review.duplicateGroup !== filters.duplicateGroup) return false;
    if (filters.dateFrom && new Date(candidate.source.publishedAt).getTime() < new Date(filters.dateFrom).getTime()) return false;
    if (filters.dateTo && new Date(candidate.source.publishedAt).getTime() > new Date(filters.dateTo).getTime()) return false;
    return true;
  });
}
```

Also import `CollectionCandidateFilters` in `lib/collection-candidates.ts`.

- [ ] **Step 3: Create candidates API**

Create `app/api/collection/candidates/route.ts`:

```ts
import { NextResponse } from "next/server";
import {
  applyCandidatePatch,
  deleteCollectionCandidates,
  filterCollectionCandidates
} from "@/lib/collection-candidates";
import {
  readCollectionCandidates,
  writeCollectionCandidates
} from "@/lib/data-store";
import type { CollectionCandidateFilters, CollectionCandidatePatch } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const candidates = await readCollectionCandidates();
  const filters: CollectionCandidateFilters = {
    platform: (url.searchParams.get("platform") || "all") as CollectionCandidateFilters["platform"],
    status: (url.searchParams.get("status") || "all") as CollectionCandidateFilters["status"],
    keywordMatched: (url.searchParams.get("keywordMatched") || "all") as CollectionCandidateFilters["keywordMatched"],
    seedMode: (url.searchParams.get("seedMode") || "all") as CollectionCandidateFilters["seedMode"],
    seedQuery: url.searchParams.get("seedQuery") || undefined,
    minLikes: url.searchParams.get("minLikes") ? Number(url.searchParams.get("minLikes")) : undefined,
    dateFrom: url.searchParams.get("dateFrom") || undefined,
    dateTo: url.searchParams.get("dateTo") || undefined,
    duplicateGroup: url.searchParams.get("duplicateGroup") || undefined
  };

  return NextResponse.json({
    candidates: filterCollectionCandidates(candidates, filters),
    total: candidates.length
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as CollectionCandidatePatch;
  const now = new Date().toISOString();
  const candidates = await readCollectionCandidates();
  const next = applyCandidatePatch(candidates, body, now);
  await writeCollectionCandidates(next);
  return NextResponse.json({ candidates: next.filter((candidate) => body.ids.includes(candidate.id)) });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids : [];
  const candidates = await readCollectionCandidates();
  const next = deleteCollectionCandidates(candidates, ids);
  await writeCollectionCandidates(next);
  return NextResponse.json({ deleted: candidates.length - next.length });
}
```

- [ ] **Step 4: Create promote API**

Create `app/api/collection/promote/route.ts`:

```ts
import { NextResponse } from "next/server";
import { promoteApprovedCandidates } from "@/lib/collection-candidates";
import {
  readCollectionCandidates,
  readSettings,
  readSourceItems,
  writeCollectionCandidates,
  writeSourceItems,
  writeTrendTopics
} from "@/lib/data-store";
import { generateTrendTopics } from "@/lib/trend-engine";

export const runtime = "nodejs";

export async function POST() {
  const now = new Date().toISOString();
  const [candidates, sources, settings] = await Promise.all([
    readCollectionCandidates(),
    readSourceItems(),
    readSettings()
  ]);

  const result = promoteApprovedCandidates({
    candidates,
    existingSources: sources,
    now
  });
  const nextSources = [...result.promoted, ...sources].map((source) => {
    const update = result.updated.find((item) => item.id === source.id || item.url === source.url);
    return update ?? source;
  });
  const topics = generateTrendTopics(nextSources, settings, now);

  await Promise.all([
    writeCollectionCandidates(result.remainingCandidates),
    writeSourceItems(nextSources),
    writeTrendTopics(topics)
  ]);

  return NextResponse.json({
    promoted: result.promoted.length,
    updated: result.updated.length,
    skipped: result.skipped,
    topics
  });
}
```

- [ ] **Step 5: Update collection status API**

In `app/api/collection/status/route.ts`, include candidate counts:

```ts
const candidates = await readCollectionCandidates();
const candidateCounts = {
  pending: candidates.filter((candidate) => candidate.status === "pending").length,
  approved: candidates.filter((candidate) => candidate.status === "approved").length,
  rejected: candidates.filter((candidate) => candidate.status === "rejected").length,
  duplicate: candidates.filter((candidate) => candidate.status === "duplicate").length
};
```

Return `candidateCounts`.

- [ ] **Step 6: Run tests and typecheck**

Run:

```powershell
npm.cmd test -- test/collection-candidates.test.ts
npx.cmd tsc --noEmit
```

Expected: PASS.

---

### Task 6: Dense Collection Inbox UI

**Files:**
- Modify: `D:\2026Q2\AI VIDEO TREND\app\collection\page.tsx`
- Test manually in browser at `http://127.0.0.1:3001/collection`

- [ ] **Step 1: Define client-side candidate types**

In `app/collection/page.tsx`, import:

```ts
import type { CollectionCandidate, CollectionCandidateStatus, ProviderStatus, SourceItem } from "@/lib/types";
```

Add state:

```ts
const [candidates, setCandidates] = useState<CollectionCandidate[]>([]);
const [selectedIds, setSelectedIds] = useState<string[]>([]);
const [candidateStatus, setCandidateStatus] = useState<CollectionCandidateStatus | "all">("pending");
const [keywordFilter, setKeywordFilter] = useState<"all" | "matched" | "unmatched">("all");
const [platformFilter, setPlatformFilter] = useState<"all" | "instagram" | "tiktok">("all");
```

- [ ] **Step 2: Load candidates in `load()`**

Add to the Promise list:

```ts
fetch(`/api/collection/candidates?status=${candidateStatus}&keywordMatched=${keywordFilter}&platform=${platformFilter}`)
```

Set:

```ts
const candidateJson = await candidateResponse.json();
setCandidates(candidateJson.candidates);
```

Use `useEffect` dependencies:

```ts
useEffect(() => {
  void load();
}, [candidateStatus, keywordFilter, platformFilter]);
```

- [ ] **Step 3: Add batch action helpers**

Add:

```ts
async function patchSelected(status: CollectionCandidateStatus) {
  if (selectedIds.length === 0) return;
  await fetch("/api/collection/candidates", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: selectedIds, status })
  });
  setSelectedIds([]);
  await load();
}

async function deleteSelected() {
  if (selectedIds.length === 0) return;
  await fetch("/api/collection/candidates", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: selectedIds })
  });
  setSelectedIds([]);
  await load();
}

async function promoteApproved() {
  const response = await fetch("/api/collection/promote", { method: "POST" });
  const json = await response.json();
  setCrawlerMessage(`Promoted ${json.promoted} approved candidates, refreshed ${json.updated}, skipped ${json.skipped}.`);
  await load();
}
```

- [ ] **Step 4: Render dense table above manual forms**

Add a section after provider status:

```tsx
<section className="border border-line bg-white p-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h3 className="text-base font-semibold">Collection Inbox</h3>
      <p className="mt-1 text-sm text-muted">Review crawled candidates before they enter the dashboard.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => patchSelected("approved")} className="border border-line px-3 py-2 text-sm">Approve selected</button>
      <button type="button" onClick={() => patchSelected("rejected")} className="border border-line px-3 py-2 text-sm">Reject selected</button>
      <button type="button" onClick={() => patchSelected("duplicate")} className="border border-line px-3 py-2 text-sm">Mark duplicate</button>
      <button type="button" onClick={deleteSelected} className="border border-line px-3 py-2 text-sm">Delete selected</button>
      <button type="button" onClick={promoteApproved} className="border border-slate-900 bg-slate-900 px-3 py-2 text-sm text-white">Promote approved</button>
    </div>
  </div>
  <div className="mt-4 grid gap-3 md:grid-cols-3">
    <select value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value as typeof platformFilter)} className="border border-line px-3 py-2 text-sm">
      <option value="all">All platforms</option>
      <option value="instagram">Instagram</option>
      <option value="tiktok">TikTok</option>
    </select>
    <select value={candidateStatus} onChange={(event) => setCandidateStatus(event.target.value as typeof candidateStatus)} className="border border-line px-3 py-2 text-sm">
      <option value="pending">Pending</option>
      <option value="approved">Approved</option>
      <option value="rejected">Rejected</option>
      <option value="duplicate">Duplicate</option>
      <option value="all">All statuses</option>
    </select>
    <select value={keywordFilter} onChange={(event) => setKeywordFilter(event.target.value as typeof keywordFilter)} className="border border-line px-3 py-2 text-sm">
      <option value="all">All keyword states</option>
      <option value="matched">Keyword matched</option>
      <option value="unmatched">Unmatched</option>
    </select>
  </div>
  <div className="mt-4 overflow-x-auto">
    <table className="min-w-full border-collapse text-left text-xs">
      <thead className="border-b border-line text-muted">
        <tr>
          <th className="py-2 pr-3"></th>
          <th className="py-2 pr-3">Status</th>
          <th className="py-2 pr-3">Platform</th>
          <th className="py-2 pr-3">Preview</th>
          <th className="py-2 pr-3">Caption</th>
          <th className="py-2 pr-3">Creator</th>
          <th className="py-2 pr-3">Seed</th>
          <th className="py-2 pr-3">Keyword</th>
          <th className="py-2 pr-3">Phrases</th>
          <th className="py-2 pr-3">Time</th>
          <th className="py-2 pr-3">Metrics</th>
        </tr>
      </thead>
      <tbody>
        {candidates.map((candidate) => (
          <tr key={candidate.id} className="border-b border-line align-top">
            <td className="py-2 pr-3">
              <input type="checkbox" checked={selectedIds.includes(candidate.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, candidate.id] : current.filter((id) => id !== candidate.id))} />
            </td>
            <td className="py-2 pr-3">{candidate.status}</td>
            <td className="py-2 pr-3">{candidate.source.platform}</td>
            <td className="py-2 pr-3">{candidate.source.thumbnailUrl ? <img src={candidate.source.thumbnailUrl} alt="" className="h-12 w-16 object-cover" /> : "-"}</td>
            <td className="max-w-xs py-2 pr-3">{candidate.source.text}</td>
            <td className="py-2 pr-3">{candidate.source.authorHandle}</td>
            <td className="py-2 pr-3">{candidate.seed.mode}: {candidate.seed.query}</td>
            <td className="py-2 pr-3">{candidate.review.keywordMatched ? candidate.review.matchedKeywords.join(", ") : "unmatched"}</td>
            <td className="max-w-xs py-2 pr-3">{candidate.review.candidatePhrases.join(", ")}</td>
            <td className="py-2 pr-3">{new Date(candidate.source.publishedAt).toLocaleDateString()}</td>
            <td className="py-2 pr-3">L {candidate.source.metrics.likes ?? 0} / C {candidate.source.metrics.comments ?? 0} / S {candidate.source.metrics.shares ?? 0} / V {candidate.source.metrics.views ?? 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</section>
```

- [ ] **Step 5: Manual browser verification**

Run: `npm.cmd run build`

Then start or restart server and open `http://127.0.0.1:3001/collection`.

Expected:

- Collection Inbox appears above import forms.
- Filters work.
- Batch buttons do not crash.
- Promotion button reports promoted/skipped counts.
- Existing source tables remain visible below.

---

### Task 7: Stronger Trend Phrase Filtering

**Files:**
- Modify: `D:\2026Q2\AI VIDEO TREND\lib\trend-engine.ts`
- Test: `D:\2026Q2\AI VIDEO TREND\test\trend-engine.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `test/trend-engine.test.ts`:

```ts
test("does not emit generic engagement phrases as trends", () => {
  const topics = generateTrendTopics(
    [
      {
        ...baseSource,
        id: "src_generic_1",
        text: "Comment FOLLOW US for the full breakdown link in bio",
        comments: ["subscribe for more", "drop comment"]
      },
      {
        ...baseSource,
        id: "src_generic_2",
        externalId: "generic_2",
        url: "https://www.tiktok.com/@demo/video/2",
        text: "Follow us and comment for free link",
        comments: ["full breakdown please"]
      }
    ],
    settings,
    "2026-07-09T00:00:00.000Z"
  );

  expect(topics.map((topic) => topic.title.toLowerCase()).join(" ")).not.toContain("follow us");
  expect(topics.map((topic) => topic.title.toLowerCase()).join(" ")).not.toContain("full breakdown");
});

test("emits repeated meaningful phrases beyond configured keywords", () => {
  const topics = generateTrendTopics(
    [
      {
        ...baseSource,
        id: "src_phrase_1",
        text: "AI avatar ad using talking product avatar for skincare",
        comments: ["talking product avatar looks useful"]
      },
      {
        ...baseSource,
        id: "src_phrase_2",
        externalId: "phrase_2",
        url: "https://www.tiktok.com/@demo/video/3",
        text: "Runway test with talking product avatar hook",
        comments: ["talking product avatar template please"]
      }
    ],
    { ...settings, keywords: ["AI avatar", "Runway"] },
    "2026-07-09T00:00:00.000Z"
  );

  expect(topics[0].keywords).toContain("talking product avatar");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm.cmd test -- test/trend-engine.test.ts`

Expected: at least one test fails because current phrase filtering is too permissive or does not prefer the meaningful phrase.

- [ ] **Step 3: Strengthen stop words and blocked phrases**

In `lib/trend-engine.ts`, extend `stopWords`:

```ts
"bio",
"breakdown",
"check",
"click",
"comment",
"comments",
"drop",
"follow",
"free",
"link",
"please",
"subscribe",
"viral",
"trending"
```

Add:

```ts
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
```

Update `isUsefulPhrase`:

```ts
function isUsefulPhrase(phrase: string): boolean {
  const words = phrase.split(" ");
  if (blockedPhrases.has(phrase)) return false;
  if (words.every((word) => stopWords.has(word))) return false;
  if (words.some((word) => word.length <= 2 && word !== "ai")) return false;
  if (words.join("").length < 8) return false;
  if (!hasSemanticAnchor(words)) return false;
  return true;
}

function hasSemanticAnchor(words: string[]): boolean {
  const anchors = new Set([
    "ai",
    "avatar",
    "product",
    "prompt",
    "workflow",
    "seedance",
    "runway",
    "sora",
    "veo",
    "ugc",
    "ads",
    "demo",
    "presenter",
    "faceless",
    "video",
    "image",
    "text"
  ]);
  return words.some((word) => anchors.has(word));
}
```

- [ ] **Step 4: Run trend tests**

Run: `npm.cmd test -- test/trend-engine.test.ts`

Expected: PASS.

---

### Task 8: Full Verification

**Files:**
- All modified files.

- [ ] **Step 1: Run full unit tests**

Run: `npm.cmd test`

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run: `npx.cmd tsc --noEmit`

Expected: no TypeScript errors.

- [ ] **Step 3: Run production build**

Run: `npm.cmd run build`

Expected: Next.js build succeeds.

- [ ] **Step 4: Browser smoke test**

Open `http://127.0.0.1:3001/collection`.

Verify:

- Collection Inbox renders.
- Manual import or browser session crawl creates candidates.
- Pending candidates can be approved.
- Promotion moves approved matched candidates into source tables.
- Dashboard only reflects promoted approved sources.

---

## Self-Review

Spec coverage:

- Candidate storage is covered in Tasks 1-3.
- Crawl-first-to-inbox behavior is covered in Task 4.
- Dense table inbox is covered in Task 6.
- Relevance gate and keyword metadata are covered in Tasks 2-5.
- Promotion into dashboard evidence is covered in Tasks 3 and 5.
- Trend phrase filtering is covered in Task 7.
- Full verification is covered in Task 8.

Placeholder scan:

- No `TBD`, `TODO`, or unspecified implementation steps remain.

Type consistency:

- Candidate status names match the approved design: `pending`, `approved`, `rejected`, `duplicate`.
- Candidate source records reuse existing `SourceItem` to keep dashboard compatibility.
- API route names match the design spec.
