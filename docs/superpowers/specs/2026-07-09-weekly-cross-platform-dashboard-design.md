# Time-Filtered Cross-Platform Dashboard Design

## Goal

Redesign the dashboard so it answers the user's operating question in this order:

1. What TikTok and Instagram items collected in the selected time window are hottest, ranked clearly from high to low?
2. Which trend topics did those items become evidence for?
3. Which items or trends are worth following up or recreating?

The page should move away from the current Instagram-first framing. TikTok and Instagram must both be first-class platforms wherever the available data supports it.

## Existing Data Model

The current data model is sufficient for a first version.

- `SourceItem` contains platform, URL, author, caption text, thumbnail, published/collected timestamps, metrics, comments, and raw provider data.
- `TrendTopic` contains heat score, status, source ids, platform breakdown, score breakdown, keywords, and summary.
- `CollectionRun` contains crawl history by platform and provider.

No schema change is required for this redesign. The dashboard should derive rankings from `SourceItem[]` using a selected time window and join trends through `TrendTopic.sourceIds`.

## Time Filtering

The dashboard must be driven by a time filter.

Default scope:
- Time window: this week.
- Platform: all platforms, with controls for `All`, `TikTok`, and `Instagram`.
- Sort: descending by a derived source heat score.

Required presets:
- `Today`
- `Yesterday`
- `This week`
- `Last week`
- `Last 7 days`
- `Last 30 days`
- `Custom range`

Filtering basis:
- Default to `collectedAt`, because the user is asking about recently crawled data.
- Show both `publishedAt` and `collectedAt` in rows so the user can distinguish old content found recently from newly posted content.
- A later enhancement can add a switch between `Collected date` and `Published date`, but the first version should keep one clear default to avoid ambiguity.

All dashboard sections must respect the selected time window:
- Source leaderboard.
- Metrics strip.
- Trend map.
- Follow-up candidates.

## Primary View: Source Leaderboard

The first screen should be a source-item leaderboard for the selected time window.

Each row/card should show:
- Preview image or platform fallback.
- Platform badge.
- Author name and handle.
- Caption/title excerpt.
- Views, likes, comments, and shares.
- Published date and collected date.
- Source heat score.
- Linked trend topics, if any.
- Open source link.

This leaderboard is the main decision surface. It should be dense enough to scan but still show media previews, because the user is evaluating video trend material.

## Source Heat Score

Use a derived score for source ranking rather than raw likes alone:

```text
views + likes * 8 + comments * 20 + shares * 30
```

Normalize or format this score for display, but keep sorting based on the raw weighted value. Missing metrics count as zero. This mirrors the existing heat logic enough to be understandable and avoids introducing a new scoring model prematurely.

## Secondary View: Time-Window Trend Map

Below or beside the leaderboard, show the trend topics represented by sources in the selected time window.

Each trend summary should show:
- Trend title.
- Heat score and status.
- TikTok / Instagram / X source counts.
- Time-window source count.
- Top representative source preview.
- Keywords.
- Link to the trend detail page.

The trend map should be derived from existing `TrendTopic[]`, but filtered or annotated based on which source ids are present in the filtered source set.

## Follow-Up Candidates

Add a "Worth following up" section that ranks items or trends by practical value.

A source is a strong follow-up candidate when it has at least one of:
- High weighted source heat.
- High shares relative to likes.
- Strong comments count.
- Appears in a trend that has both TikTok and Instagram evidence.
- Has a usable preview, author, and source URL.

Each candidate should include a short reason string, for example:
- "High TikTok shares"
- "Cross-platform trend evidence"
- "Strong comments signal"
- "Top source in this trend"

This should be explainable, not a black box.

## Page Structure

Recommended layout:

1. Header
   - Title: `Trend Dashboard`
   - Subtitle: `TikTok and Instagram sources in the selected time window, ranked by heat.`

2. Metrics strip
   - TikTok sources in the selected time window.
   - Instagram sources in the selected time window.
   - Total engagement in the selected time window.
   - Hot trends in the selected time window.
   - Follow-up candidates.

3. Time, platform, and sort controls
   - Time segmented control: `Today`, `This week`, `Last 7 days`, `Last 30 days`, plus custom range.
   - Platform segmented control: `All`, `TikTok`, `Instagram`.
   - Sort options: `Heat`, `Latest`, `Likes`, `Comments`, `Shares`.

4. Source Leaderboard
   - Main table/card list.
   - Default sort by heat descending.
   - Rows link to source and associated trend pages.

5. Time-Window Trend Map
   - Compact trend cards or table.
   - Explicit TikTok and Instagram columns.

6. Follow-Up Candidates
   - Compact list with reasons.
   - Links to source and trend detail.

## Trend Detail Page

The trend detail page should also become cross-platform.

It should show:
- Platform breakdown including TikTok, Instagram, and X.
- Source evidence grouped or filterable by platform.
- Metrics totals by platform.
- Representative source previews.
- A follow-up note area generated from the same reason rules used on the dashboard.

The existing detail page should not imply that Instagram is the primary platform.

## Empty and Partial Data States

The UI should distinguish these cases:

- No sources in selected time window: show a clear empty state and keep the time controls visible.
- TikTok missing metrics: show `-` for unavailable metrics, not zero.
- Platform has no configured crawl sources: do not show it as a data failure.
- Trends exist but no filtered source links: show all-time trend context separately from filtered evidence.

## Testing

Add focused tests for pure derivation helpers where possible:

- Time-window source filtering by `collectedAt`.
- Source heat sorting.
- Platform counts for TikTok and Instagram.
- Trend-to-source joining.
- Follow-up reason generation.

Run the existing test suite, TypeScript check, and production build after implementation.

## Non-Goals

- Do not change crawler behavior in this redesign.
- Do not add a new database schema.
- Do not introduce AI-generated recommendations beyond transparent rule-based follow-up reasons.
- Do not remove existing trend table/detail behavior until the new dashboard covers the same navigation needs.
