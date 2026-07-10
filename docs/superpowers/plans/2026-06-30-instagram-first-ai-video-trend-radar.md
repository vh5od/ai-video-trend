# Instagram-First AI Video Trend Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Next.js MVP that validates whether Instagram/Reels source items can become ranked AI video trend topics.

**Architecture:** Use Next.js App Router with API routes, TypeScript domain modules, and JSON files under `data/` as the storage boundary. The frontend reads only through API routes, while tested library modules handle validation, collector status, source normalization, and trend generation.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Vitest, React, local JSON storage.

---

## File Structure

- `package.json`: scripts and dependencies.
- `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`: framework configuration.
- `app/layout.tsx`, `app/page.tsx`, `app/collection/page.tsx`, `app/trends/[id]/page.tsx`, `app/platforms/page.tsx`, `app/settings/page.tsx`: app pages.
- `app/api/sources/route.ts`, `app/api/trends/route.ts`, `app/api/trends/[id]/route.ts`, `app/api/settings/route.ts`, `app/api/collection/status/route.ts`: JSON APIs.
- `components/*.tsx`: table-first UI building blocks.
- `lib/types.ts`: shared domain types.
- `lib/validation.ts`: manual Instagram seed validation.
- `lib/collectors.ts`: provider status model.
- `lib/trend-engine.ts`: deterministic trend grouping and scoring.
- `lib/data-store.ts`: local JSON read/write helpers.
- `test/*.test.ts`: unit tests for validation, collectors, and trend generation.
- `data/*.json`: seed settings, source items, trend topics, and collection runs.

## Tasks

### Task 1: Scaffold Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `app/globals.css`
- Create: `app/layout.tsx`

- [ ] **Step 1: Add framework and test configuration**

Create a Next.js TypeScript project configuration with scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Add the base layout**

Create a sidebar layout with navigation links to Dashboard, Collection, Platforms, and Settings.

- [ ] **Step 3: Checkpoint**

Run: `npm.cmd install`

Expected: dependencies install successfully and `package-lock.json` is created.

### Task 2: Domain Types And Seed Data

**Files:**
- Create: `lib/types.ts`
- Create: `data/settings.json`
- Create: `data/source-items.json`
- Create: `data/trend-topics.json`
- Create: `data/collection-runs.json`

- [ ] **Step 1: Define shared types**

Add `SourceItem`, `TrendTopic`, `CollectionRun`, and `Settings` interfaces matching the design doc.

- [ ] **Step 2: Add sample Instagram source items**

Create a few realistic seeded Instagram-style records for AI video/Reels trends, with URLs, captions, hashtags, and engagement metrics.

- [ ] **Step 3: Checkpoint**

Run: `npm.cmd test -- --run`

Expected: test runner starts once tests exist in later tasks.

### Task 3: Validation And Collector Status With TDD

**Files:**
- Create: `test/validation.test.ts`
- Create: `test/collectors.test.ts`
- Create: `lib/validation.ts`
- Create: `lib/collectors.ts`

- [ ] **Step 1: Write failing validation tests**

Test that a manual seed requires a URL and text, normalizes hashtags, and defaults platform to Instagram.

- [ ] **Step 2: Verify tests fail**

Run: `npm.cmd test -- validation`

Expected: tests fail because `lib/validation.ts` does not exist yet.

- [ ] **Step 3: Implement validation**

Add `validateManualSeed()` and `normalizeManualSeed()` with explicit error messages.

- [ ] **Step 4: Write failing collector tests**

Test that Instagram returns `not_configured` without credentials and `ready` when an access token is present.

- [ ] **Step 5: Verify tests fail**

Run: `npm.cmd test -- collectors`

Expected: tests fail until `lib/collectors.ts` is implemented.

- [ ] **Step 6: Implement collector status**

Add `getInstagramCollectorStatus(env)` with capabilities and explicit status messages.

- [ ] **Step 7: Verify**

Run: `npm.cmd test`

Expected: validation and collector tests pass.

### Task 4: Trend Engine With TDD

**Files:**
- Create: `test/trend-engine.test.ts`
- Create: `lib/trend-engine.ts`

- [ ] **Step 1: Write failing trend tests**

Test that matching source items group by strongest AI video keyword and produce a ranked heat score.

- [ ] **Step 2: Verify tests fail**

Run: `npm.cmd test -- trend-engine`

Expected: tests fail because `lib/trend-engine.ts` does not exist yet.

- [ ] **Step 3: Implement deterministic grouping**

Add `generateTrendTopics(sources, settings)` and score helpers.

- [ ] **Step 4: Verify**

Run: `npm.cmd test`

Expected: all unit tests pass.

### Task 5: Data Store And API Routes

**Files:**
- Create: `lib/data-store.ts`
- Create: `app/api/sources/route.ts`
- Create: `app/api/trends/route.ts`
- Create: `app/api/trends/[id]/route.ts`
- Create: `app/api/settings/route.ts`
- Create: `app/api/collection/status/route.ts`

- [ ] **Step 1: Add local JSON helpers**

Read and write typed JSON files from `data/`.

- [ ] **Step 2: Add sources API**

`GET /api/sources` returns source items. `POST /api/sources` validates manual seed input, appends a source item, records a collection run, regenerates trends, and returns the stored item.

- [ ] **Step 3: Add trends APIs**

`GET /api/trends` returns generated or on-the-fly trend topics. `GET /api/trends/[id]` returns one trend and its source evidence.

- [ ] **Step 4: Add settings and status APIs**

Return local settings and collector status.

- [ ] **Step 5: Verify**

Run: `npm.cmd test`

Expected: all unit tests pass.

### Task 6: Table-First UI

**Files:**
- Create: `components/Badge.tsx`
- Create: `components/MetricStrip.tsx`
- Create: `components/TrendTable.tsx`
- Create: `components/SourceTable.tsx`
- Create: `app/page.tsx`
- Create: `app/collection/page.tsx`
- Create: `app/trends/[id]/page.tsx`
- Create: `app/platforms/page.tsx`
- Create: `app/settings/page.tsx`

- [ ] **Step 1: Build reusable table components**

Use compact rows, light borders, restrained badges, and no decorative card-heavy layout.

- [ ] **Step 2: Build dashboard**

Fetch `/api/trends` and `/api/sources`; show metrics and ranked trend table.

- [ ] **Step 3: Build collection page**

Fetch `/api/collection/status` and `/api/sources`; render Instagram status, manual seed form, and raw source table.

- [ ] **Step 4: Build detail and placeholder pages**

Trend detail shows evidence. Platforms shows Instagram active and X/TikTok not configured. Settings shows local configuration.

- [ ] **Step 5: Verify build**

Run: `npm.cmd run build`

Expected: production build completes.

### Task 7: Runtime Verification

**Files:**
- Modify only if verification exposes defects.

- [ ] **Step 1: Start dev server**

Run: `npm.cmd run dev`

Expected: app serves locally.

- [ ] **Step 2: Browser review**

Open the local app and verify Dashboard, Collection, Trend Detail, Platforms, and Settings render without blank screens.

- [ ] **Step 3: Manual seed smoke test**

Submit a new Instagram source from the Collection page and verify it appears in raw sources and affects the dashboard trend table.

- [ ] **Step 4: Final verification**

Run: `npm.cmd test` and `npm.cmd run build`

Expected: tests and build pass.
