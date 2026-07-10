# Instagram TikTok Hybrid Crawler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a synchronous Apify-like crawler import system for Instagram and TikTok that supports hashtag, keyword, and account tasks through pluggable providers.

**Architecture:** Add crawler task/provider types to the shared model, implement normalization and import execution in `lib/crawler.ts`, then expose it through API routes and a compact Collection page form. The first functional provider is `manual_import`; other providers report explicit status and failure messages.

**Tech Stack:** Next.js App Router, TypeScript, local JSON storage, Vitest.

---

## File Structure

- Modify `lib/types.ts`: add crawler task, provider, mode, and run-result types.
- Create `lib/crawler.ts`: validate tasks, report provider status, normalize Instagram/TikTok provider records, deduplicate, and execute manual import tasks.
- Create `test/crawler.test.ts`: TDD coverage for validation, normalization, deduplication, and provider status.
- Create `app/api/crawler/status/route.ts`: expose provider capabilities to the UI.
- Create `app/api/crawler/run/route.ts`: run a crawler task, write sources/runs/topics, and return a summary.
- Modify `app/api/collection/status/route.ts`: include crawler provider status in the existing collection status response.
- Modify `app/collection/page.tsx`: add an Instagram/TikTok crawler import form.

### Task 1: Crawler Types And Validation

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/crawler.ts`
- Test: `test/crawler.test.ts`

- [ ] **Step 1: Write the failing validation tests**

```ts
import { describe, expect, test } from "vitest";
import { validateCrawlerTask } from "@/lib/crawler";

describe("crawler task validation", () => {
  test("accepts a manual Instagram hashtag import task with items", () => {
    const result = validateCrawlerTask({
      platform: "instagram",
      mode: "hashtag",
      query: "#aivideo",
      provider: "manual_import",
      items: [{ url: "https://www.instagram.com/reel/abc/", caption: "AI video" }]
    });

    expect(result.valid).toBe(true);
    expect(result.task?.query).toBe("aivideo");
    expect(result.task?.limit).toBe(50);
  });

  test("rejects manual import tasks without items", () => {
    const result = validateCrawlerTask({
      platform: "tiktok",
      mode: "keyword",
      query: "ai avatar",
      provider: "manual_import"
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Manual import requires an items array.");
  });
});
```

- [ ] **Step 2: Run validation tests to verify RED**

Run: `npm test -- test/crawler.test.ts`

Expected: FAIL because `@/lib/crawler` does not exist.

- [ ] **Step 3: Implement minimal crawler types and validation**

Add crawler types to `lib/types.ts`, then create `lib/crawler.ts` with `validateCrawlerTask`.

- [ ] **Step 4: Run validation tests to verify GREEN**

Run: `npm test -- test/crawler.test.ts`

Expected: PASS for validation tests.

### Task 2: Normalizers And Deduplication

**Files:**
- Modify: `lib/crawler.ts`
- Test: `test/crawler.test.ts`

- [ ] **Step 1: Write failing normalization tests**

```ts
import { importCrawlerItems } from "@/lib/crawler";
import type { SourceItem } from "@/lib/types";

const existingSource: SourceItem = {
  id: "src_existing",
  platform: "instagram",
  externalId: "existing",
  url: "https://www.instagram.com/reel/existing/",
  authorName: "Existing",
  authorHandle: "existing",
  title: "Existing",
  text: "Existing AI video",
  hashtags: ["aivideo"],
  language: "en",
  region: "unknown",
  mediaType: "video",
  publishedAt: "2026-07-01T00:00:00.000Z",
  collectedAt: "2026-07-01T00:00:00.000Z",
  metrics: {},
  raw: {},
  seeded: false
};

test("imports TikTok provider records as normalized source items", () => {
  const result = importCrawlerItems({
    task: {
      platform: "tiktok",
      mode: "keyword",
      query: "ai avatar",
      provider: "manual_import",
      limit: 50,
      items: [
        {
          videoId: "tt_1",
          desc: "AI avatar product demo",
          webVideoUrl: "https://www.tiktok.com/@demo/video/1",
          authorMeta: { name: "Demo Lab", nickName: "Demo Lab" },
          hashtags: [{ name: "aivideo" }],
          playCount: 12000,
          diggCount: 900,
          commentCount: 22,
          shareCount: 40,
          createTimeISO: "2026-07-01T12:00:00.000Z"
        }
      ]
    },
    existingSources: [],
    now: "2026-07-08T00:00:00.000Z"
  });

  expect(result.imported).toHaveLength(1);
  expect(result.imported[0].platform).toBe("tiktok");
  expect(result.imported[0].metrics.views).toBe(12000);
  expect(result.imported[0].hashtags).toEqual(["aivideo"]);
});
```

- [ ] **Step 2: Run normalizer tests to verify RED**

Run: `npm test -- test/crawler.test.ts`

Expected: FAIL because `importCrawlerItems` is not implemented.

- [ ] **Step 3: Implement Instagram/TikTok normalizers and deduplication**

Implement `importCrawlerItems`, `normalizeInstagramCrawlerItem`, and `normalizeTikTokCrawlerItem`.

- [ ] **Step 4: Run normalizer tests to verify GREEN**

Run: `npm test -- test/crawler.test.ts`

Expected: PASS for validation and normalization tests.

### Task 3: Provider Status

**Files:**
- Modify: `lib/crawler.ts`
- Test: `test/crawler.test.ts`

- [ ] **Step 1: Write failing provider status tests**

```ts
import { getCrawlerProviderStatuses } from "@/lib/crawler";

test("reports manual import ready and browser session partial", () => {
  const statuses = getCrawlerProviderStatuses({});
  const instagramManual = statuses.find(
    (status) => status.platform === "instagram" && status.provider === "manual_import"
  );
  const tiktokBrowser = statuses.find(
    (status) => status.platform === "tiktok" && status.provider === "browser_session"
  );

  expect(instagramManual?.status).toBe("ready");
  expect(tiktokBrowser?.status).toBe("partial");
});
```

- [ ] **Step 2: Run status tests to verify RED**

Run: `npm test -- test/crawler.test.ts`

Expected: FAIL because provider status function is not implemented.

- [ ] **Step 3: Implement provider status**

Add `getCrawlerProviderStatuses` with provider capability metadata.

- [ ] **Step 4: Run status tests to verify GREEN**

Run: `npm test -- test/crawler.test.ts`

Expected: PASS for crawler tests.

### Task 4: API Routes

**Files:**
- Create: `app/api/crawler/status/route.ts`
- Create: `app/api/crawler/run/route.ts`
- Modify: `app/api/collection/status/route.ts`

- [ ] **Step 1: Implement status route**

Create `GET /api/crawler/status` returning `{ providers }`.

- [ ] **Step 2: Implement run route**

Create `POST /api/crawler/run` that validates a task, imports manual items, writes source items, writes trend topics, and writes collection runs.

- [ ] **Step 3: Include crawler status in collection status**

Add `crawlerProviders` to the existing collection status response.

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: all tests pass.

### Task 5: Collection UI

**Files:**
- Modify: `app/collection/page.tsx`

- [ ] **Step 1: Add crawler form state**

Add state for platform, mode, provider, query, JSON textarea, and keyword filter.

- [ ] **Step 2: Add crawler submit handler**

Parse JSON, POST to `/api/crawler/run`, display API errors, and reload sources/status.

- [ ] **Step 3: Add compact crawler form UI**

Place it above manual seed forms with restrained table-first styling.

- [ ] **Step 4: Run build-level verification**

Run: `npm test`

Expected: all tests pass.

## Self-Review

Spec coverage:

- Platforms, modes, providers, manual import, normalization, deduplication, API routes, run history, and UI are covered.
- Browser automation is intentionally represented as provider metadata only.

Placeholder scan:

- The plan contains no `TBD` or undefined tasks.

Type consistency:

- `CrawlerTaskInput`, `CrawlerTask`, `CrawlerProvider`, and `CrawlerMode` are introduced before use.
