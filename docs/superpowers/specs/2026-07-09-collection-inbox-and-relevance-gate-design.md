# Collection Inbox and Relevance Gate Design

## Goal

Separate social crawling from trend publishing.

Hashtags and creators are search seeds. They help discover candidate videos, but they should not directly define trends or automatically populate the dashboard. Crawled items first enter a reviewable collection inbox. Only cleaned and approved items become dashboard evidence and trend-engine input.

## Current Problem

The current flow uses `source-items.json` as both the crawl storage and dashboard/trend source. That makes every valid crawled item eligible for trend generation too early.

This causes three product problems:

- Hashtag and creator searches collect useful candidates and unrelated hot items into the same pool.
- The user has no dedicated station for editing, deleting, deduplicating, or approving crawled videos.
- Trend extraction can surface generic phrases such as `comment`, `subscribe`, `follow us`, or `full breakdown`, because phrase quality filtering is too weak.

## Proposed Data Flow

1. Settings define Instagram and TikTok hashtags, creators, keywords, minimum likes, crawl limits, and comment limits.
2. Daily crawl tasks use hashtags and creators only as discovery seeds.
3. Every fetched item is normalized and stored in a collection inbox as a candidate record.
4. Candidate records receive automatic metadata:
   - status
   - keyword match result
   - matched keywords
   - low-like flag
   - duplicate group
   - candidate trend phrases
   - source seed context
5. The user reviews candidates in a dense table and can approve, reject, delete, edit, or mark duplicates.
6. Only approved records are promoted into the dashboard evidence set.
7. The trend engine uses only approved evidence and extracts repeated meaningful phrases beyond configured search keywords.

## Candidate Statuses

Candidate records use four statuses:

- `pending`: newly crawled or not yet reviewed.
- `approved`: relevant and allowed into dashboard and trend generation.
- `rejected`: not relevant; retained for audit/history but hidden from dashboard.
- `duplicate`: duplicate of another candidate or source; hidden from dashboard unless merged into an approved record.

Delete is a hard removal action, not a status.

## Collection Inbox

The inbox should be a dense operational table, not a card feed.

Required columns:

- checkbox
- status
- platform
- preview
- caption/title
- creator
- seed source, such as `instagram hashtag: aivideo`
- keyword match
- candidate phrases
- published time
- metrics: likes, comments, shares, views
- duplicate group
- actions

Required filters:

- platform
- status
- seed type: hashtag or creator
- seed value
- keyword matched or unmatched
- minimum likes
- date range
- duplicate group

Required batch actions:

- approve selected
- reject selected
- mark duplicate
- delete selected
- regenerate candidate phrases

Inline editing should support at least caption/title, creator display fields, published time, metrics, and candidate phrases.

## Relevance Gate

Keyword matching is a gate between the inbox and dashboard, not the original crawl trigger.

Default behavior:

- Keyword-matched candidates can be approved normally.
- Unmatched candidates remain visible in the inbox as off-topic hot items.
- Unmatched candidates do not enter dashboard or trend generation unless the user manually approves them.

This preserves adjacent discovery without polluting the main dashboard.

## Trend Phrase Rules

Trend phrases are not the same as configured search keywords.

A phrase can become a trend signal only when it:

- appears in multiple approved items;
- appears in captions, titles, hashtags, or comments;
- is not equal to a configured search keyword;
- is not a generic action or engagement phrase;
- has enough semantic substance to describe a product, model, format, visual style, workflow, or creative pattern.

The stoplist should exclude generic marketing and engagement terms such as:

- `comment`
- `subscribe`
- `follow`
- `follow us`
- `link in bio`
- `full breakdown`
- `drop comment`
- `free link`
- `click link`
- `check bio`
- `viral video`
- `trending reels`

The extraction logic should prefer meaningful noun phrases and known AI/video terms, such as:

- `AI avatar UGC ads`
- `talking product avatar`
- `Seedance text to video`
- `image to video workflow`
- `prompt to video`
- `faceless product demo`
- `virtual presenter`

## Dashboard Behavior

The dashboard should not show every crawled item.

Default dashboard input:

- approved items only
- current default time window: this week
- sorted by heat score from high to low

Dashboard priorities:

1. Show ranked Instagram and TikTok approved items from the selected time window.
2. Show which repeated meaningful phrases became trends.
3. Show follow-up and remake candidates based on heat, freshness, relevance, and cross-platform evidence.

## Storage Direction

Keep existing `source-items.json` as the approved evidence store for backward compatibility.

Add a separate candidate store, for example `collection-candidates.json`, to hold pending, rejected, duplicate, and approved candidate records. Approved candidates can be promoted into `source-items.json`.

This avoids breaking existing dashboard and trend detail pages while adding a proper review layer.

## APIs

Add inbox APIs:

- `GET /api/collection/candidates`: list candidates with filters.
- `PATCH /api/collection/candidates`: batch status updates and field edits.
- `DELETE /api/collection/candidates`: delete selected candidates.
- `POST /api/collection/promote`: promote approved candidates into source items and regenerate trends.

Update crawl APIs:

- Daily crawl and manual crawler runs should write candidates first.
- Promotion should become the only path from crawled candidates to dashboard evidence.

## Testing

Core tests should cover:

- crawled items are stored as pending candidates instead of immediately entering sources;
- keyword match metadata is computed and stored on candidates;
- unmatched candidates are not promoted unless manually approved;
- duplicate candidates are detected and excluded from dashboard;
- approved candidates promote into `source-items.json`;
- trend generation uses only approved source items;
- generic phrases like `comment`, `subscribe`, and `follow us` are not emitted as trends;
- meaningful repeated phrases beyond configured keywords are emitted as trends.

## Out of Scope

This design does not add a real database, authentication, background scheduler service, or AI-based semantic phrase extraction. The first implementation should stay file-backed and rule-based to match the current app architecture.
