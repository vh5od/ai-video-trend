# Instagram and TikTok Hybrid Crawler Design

## Purpose

Build an Apify-like internal crawler tool for AI video trend research. The tool supports Instagram and TikTok collection jobs for hashtags, keywords, and accounts, while keeping platform-specific collection sources replaceable.

The first version prioritizes a stable task contract, normalized source output, import-based ingestion, run history, and future provider slots over fragile direct scraping.

## Scope

The crawler supports:

- Platforms: Instagram and TikTok.
- Query modes: `hashtag`, `keyword`, and `account`.
- Providers: `manual_import`, `provider_api`, `official_api`, and `browser_session`.
- JSON dataset ingestion for provider/API exports.
- Normalization into the existing `SourceItem` model.
- Duplicate filtering by URL and external ID.
- Collection run records in the existing run history.
- Trend regeneration after successful imports.

The first working provider is `manual_import`. Other providers are represented by clear status and capability metadata so they can be implemented without changing the public task contract.

## Non-Goals

The first version will not:

- Bypass login, CAPTCHA, rate limits, or anti-abuse protections.
- Download or mirror full video files.
- Promise unattended scraping from Instagram or TikTok without a configured provider.
- Add a job queue or background worker.
- Add account credential storage.
- Replace the existing Apify Instagram importer immediately.

## Architecture

Use a small crawler module in `lib/`:

- `lib/crawler.ts`: task input validation, provider status, import execution, source normalization, duplicate filtering.
- `lib/types.ts`: shared crawler task and provider types.
- `app/api/crawler/run/route.ts`: POST endpoint for running an import task.
- `app/api/crawler/status/route.ts`: GET endpoint for provider capability/status.
- `app/collection/page.tsx`: a compact form for creating import tasks and reviewing run status.

The crawler is synchronous in the API route for MVP. A task accepts raw JSON items, converts them to `SourceItem` records, writes local JSON files, and returns a run summary.

## Task Contract

Crawler task input:

```ts
{
  platform: "instagram" | "tiktok";
  mode: "hashtag" | "keyword" | "account";
  query: string;
  provider: "manual_import" | "provider_api" | "official_api" | "browser_session";
  limit?: number;
  items?: unknown[];
  filterToKeywords?: boolean;
}
```

Rules:

- `platform`, `mode`, `query`, and `provider` are required.
- `query` is trimmed and stored in `SourceItem.raw.query`.
- `limit` is clamped to a practical local value.
- `items` is required for `manual_import`.
- Unsupported providers return a failed run with a clear message instead of attempting collection.

## Provider Behavior

`manual_import`:

- Accepts JSON arrays from Apify-like exports, third-party providers, or saved browser-session outputs.
- Supports both Instagram and TikTok.
- Stores imported records and run metadata.

`provider_api`:

- Reserved for Apify Actor, RapidAPI, or other paid data-provider integrations.
- Reports `not_configured` until credentials are present.

`official_api`:

- Reserved for approved platform APIs.
- Reports `not_configured` unless relevant credentials are present.

`browser_session`:

- Reserved for local, user-authorized browser automation.
- Reports `partial` because it requires local login state and user consent.
- Does not bypass platform restrictions.

## Normalization

Instagram input fields can include Apify-style keys such as:

- `id`
- `shortCode`
- `caption`
- `hashtags`
- `url`
- `commentsCount`
- `displayUrl`
- `images`
- `videoUrl`
- `likesCount`
- `videoViewCount`
- `videoPlayCount`
- `timestamp`
- `ownerFullName`
- `ownerUsername`

TikTok input fields can include common provider keys such as:

- `id`
- `videoId`
- `desc`
- `text`
- `webVideoUrl`
- `url`
- `authorMeta`
- `author`
- `createTimeISO`
- `createTime`
- `diggCount`
- `likeCount`
- `commentCount`
- `shareCount`
- `playCount`
- `collectCount`
- `hashtags`
- `covers`
- `videoUrl`

The normalizer must be defensive. Missing optional metrics should remain `undefined`. Missing required URL or text should skip the record as invalid.

## Deduplication

Each import compares against existing sources and records imported during the same run.

Duplicate keys:

- Exact URL.
- Exact external ID when present.

Skipped duplicates are counted in the run result.

## Error Handling

Validation errors return HTTP 400 from the API route.

Provider unavailability returns a `CollectionRun` with:

- `status: "failed"`
- `itemsFound: 0`
- `itemsStored: 0`
- A message that names the missing provider configuration.

Manual import with all invalid records still writes a run record. This makes failed data pulls visible in the UI.

## UI

The Collection page gains a compact crawler import section:

- Platform selector.
- Mode selector.
- Provider selector.
- Query input.
- JSON textarea.
- Keyword filter toggle.
- Submit button.

The section should remain table-first and operational. It should not become a marketing-style page.

## Testing

Add focused Vitest coverage for:

- Validating task input.
- Mapping Instagram records through the generic crawler.
- Mapping TikTok records through the generic crawler.
- Deduplicating against existing sources.
- Returning clear status for unconfigured providers.

Run the full test suite before claiming completion.
