# Instagram-First AI Video Trend Radar MVP Design

## Purpose

Build a local, private AI video trend radar that first validates whether Instagram/Reels can provide useful overseas AI video trend signals. The first version prioritizes collection feasibility, source verification, and trend aggregation over a polished public product.

The core question for MVP is:

> Can we collect or seed enough Instagram AI video source items to identify useful overseas AI video hotspots?

## Scope

The MVP is a local full-stack web app with:

- A minimal table-first dashboard for trend review.
- An Instagram-first collection validation page.
- Manual seed input for Instagram Reel/source records.
- API adapters with clear credential and capability status.
- Local JSON storage for source items, settings, and generated trend topics.
- A simple scoring and clustering pipeline suitable for validating the product loop.

X and TikTok are included only as future adapter placeholders. They are not first-phase validation targets.

## Non-Goals

The MVP will not:

- Scrape Instagram without an approved or explicitly configured data source.
- Download, mirror, or republish video files.
- Provide public user registration, payments, or SEO pages.
- Implement production Supabase persistence.
- Promise automatic Instagram collection without credentials.
- Generate video scripts or creator outreach workflows.

## Architecture

Use Next.js, TypeScript, Tailwind CSS, API routes, and local JSON-backed storage.

The frontend reads data only through API routes. It does not import mock data directly. This keeps the UI stable when local JSON is later replaced by Supabase, official APIs, or a third-party data provider.

Primary modules:

- `app/`: App Router pages and layout.
- `components/`: Table, filter, status, and metric UI components.
- `lib/data-store.ts`: Local JSON read/write helpers.
- `lib/collectors/`: Platform collector interfaces and adapters.
- `lib/trends/`: Seed normalization, scoring, and basic topic aggregation.
- `data/`: Local JSON files for settings, source items, trend topics, and collection runs.

## Pages

### Dashboard

Route: `/`

The dashboard shows an Instagram-first trend table. It is designed for fast scanning, not visual storytelling.

Columns:

- Rank
- Trend
- Heat
- Status
- Instagram Sources
- Movement
- Keywords
- Updated

The top of the page shows compact validation metrics:

- Total Instagram source items
- Seeded sources in the last 24 hours
- Generated trend topics
- Latest collection run status

### Collection

Route: `/collection`

This is the most important MVP page.

The default tab is Instagram. It shows:

- Provider status: `not_configured`, `ready`, `partial`, or `failed`
- Latest run time
- Sample count
- Error reason when unavailable
- Supported capabilities
- Manual seed form
- Raw Instagram source table

Manual seed fields:

- URL
- Caption/text
- Author handle
- Published time
- Views
- Likes
- Comments
- Shares
- Hashtags
- Matched keywords

The form stores normalized source items locally. It allows the product loop to be tested before platform credentials exist.

### Trend Detail

Route: `/trends/[id]`

The detail page explains why a trend exists.

It shows:

- Summary
- Heat score
- Score explanation
- Related keywords
- Status label
- Source evidence table

The evidence table links back to original Instagram URLs.

### Platform Placeholders

Route: `/platforms`

This page exists to show future expansion paths for X and TikTok, but the first phase clearly labels them as not configured. The page avoids implying that non-Instagram data is already available.

### Settings

Route: `/settings`

Settings are read from local JSON. First version can display configuration and later add editing.

Settings include:

- Instagram hashtags
- Instagram creator handles
- AI video keyword pool
- Refresh schedule
- Provider credential status

## Data Model

### Source Item

Represents one social source record, usually an Instagram Reel or Instagram post for MVP.

Fields:

- `id`
- `platform`
- `externalId`
- `url`
- `authorName`
- `authorHandle`
- `title`
- `text`
- `hashtags`
- `language`
- `region`
- `mediaType`
- `publishedAt`
- `collectedAt`
- `metrics`
- `raw`
- `seeded`

### Trend Topic

Represents a grouped AI video trend.

Fields:

- `id`
- `title`
- `summary`
- `keywords`
- `heatScore`
- `status`
- `firstSeenAt`
- `lastSeenAt`
- `sourceCount`
- `platformBreakdown`
- `scoreBreakdown`
- `sourceIds`

### Collection Run

Represents an attempted collector execution or seed import.

Fields:

- `id`
- `platform`
- `provider`
- `status`
- `startedAt`
- `finishedAt`
- `itemsFound`
- `itemsStored`
- `message`
- `errorCode`

## Collector Design

All collectors implement a common interface:

- `getStatus()`
- `collect(options)`
- `normalize(rawItem)`

Instagram has the first real adapter boundary.

Initial Instagram adapter behavior:

- If no credentials or provider config exists, return `not_configured`.
- If credentials exist later, expose capability checks before attempting collection.
- Never silently fail. Return a collection run with an explicit message.

Manual seed import is treated as a first-class collector path named `manual_seed`. This makes seeded and API-collected records flow through the same normalization and scoring pipeline.

## Trend Aggregation

The first version uses deterministic keyword grouping, not embeddings.

Process:

1. Normalize source item text, hashtags, and keywords.
2. Match against configured AI video keyword pool.
3. Group records by strongest keyword cluster.
4. Generate trend title from top matched keywords and representative captions.
5. Calculate heat score from engagement metrics, freshness, and source count.
6. Store generated trend topics in local JSON.

This is intentionally simple. It validates whether the input signal is useful before adding AI summaries or vector clustering.

## Scoring

Instagram-first MVP score:

```text
heat_score =
  0.45 * engagement_score
+ 0.25 * freshness_score
+ 0.20 * keyword_relevance_score
+ 0.10 * source_count_score
```

Engagement score considers views, likes, comments, and shares when present. Missing metrics are treated as unknown, not zero, so manually seeded records can still be reviewed.

Status labels:

- `emerging`: recent source with growing engagement or multiple matching AI video keywords
- `hot`: high engagement and strong keyword match
- `stable`: useful but not accelerating
- `cooling`: older or lower-freshness signal

## Error Handling

The product must make collection limitations obvious.

Examples:

- Missing Instagram credentials: `not_configured`
- Provider lacks hashtag search access: `partial`
- API rate limit or permission issue: `failed`
- Manual seed missing URL or text: form validation error

Errors are shown in the Collection page and stored in collection run history.

## Visual Direction

Use an extreme table-first interface:

- White background
- Light gray borders
- Compact rows
- Sticky table headers where useful
- Status badges with restrained color
- Minimal decorative styling

The UI should feel like a private research spreadsheet with better source traceability.

## Testing And Verification

Verification for the MVP:

- API routes return valid JSON for trends, sources, settings, and collection status.
- Manual seed records can be added and then appear in source tables.
- Trend generation converts seeded Instagram records into ranked topics.
- Trend detail pages show linked evidence.
- Empty or unconfigured collectors show clear status instead of failing silently.

## Implementation Order

1. Scaffold Next.js app with TypeScript and Tailwind.
2. Add local JSON data store and seed files.
3. Define source, trend, settings, and collection run types.
4. Build Instagram manual seed API and collection status API.
5. Build trend generation logic.
6. Build table-first dashboard.
7. Build collection validation page.
8. Build trend detail, platform placeholder, and settings pages.
9. Run local verification and browser review.

## Open Decisions Resolved

- First platform: Instagram.
- First validation method: manual seed plus adapter status.
- Storage: local JSON for MVP.
- UI style: extreme table-first dashboard.
- Real scraping: out of scope unless an approved data source is configured.
