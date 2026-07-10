import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const filePath = process.argv[2];
const importAll = process.argv.includes("--all");

if (!filePath) {
  console.error("Usage: node scripts/import-apify-json.mjs <apify-json-path> [--all]");
  process.exit(1);
}

const root = process.cwd();
const dataDir = path.join(root, "data");
const now = new Date().toISOString();

const [items, sources, settings, runs] = await Promise.all([
  readJsonAbsolute(filePath, []),
  readJson(path.join(dataDir, "source-items.json"), []),
  readJson(path.join(dataDir, "settings.json"), {
    instagramHashtags: [],
    instagramCreators: [],
    keywords: []
  }),
  readJson(path.join(dataDir, "collection-runs.json"), [])
]);

const existingUrls = new Set(sources.map((source) => source.url));
const existingExternalIds = new Set(sources.map((source) => source.externalId).filter(Boolean));
const imported = [];
let skippedDuplicates = 0;
let skippedUnmatched = 0;
let skippedInvalid = 0;

for (const item of items) {
  if (!item?.url || !item?.caption) {
    skippedInvalid += 1;
    continue;
  }

  const externalId = item.id || item.shortCode || item.url;
  if (existingUrls.has(item.url) || existingExternalIds.has(externalId)) {
    skippedDuplicates += 1;
    continue;
  }

  if (!importAll && !matchesKeywords(item, settings.keywords)) {
    skippedUnmatched += 1;
    continue;
  }

  const source = mapApifyItemToSource(item, now);
  imported.push(source);
  existingUrls.add(source.url);
  existingExternalIds.add(source.externalId);
}

const nextSources = [...imported, ...sources];
const topics = generateTrendTopics(nextSources, settings, now);
const run = {
  id: `run_apify_file_${Date.now()}`,
  platform: "instagram",
  provider: "apify_instagram_scraper_file",
  status: "ready",
  startedAt: now,
  finishedAt: now,
  itemsFound: items.length,
  itemsStored: imported.length,
  message: `Imported ${imported.length} Apify Instagram records from ${path.basename(filePath)}. Skipped ${skippedDuplicates} duplicates, ${skippedUnmatched} unmatched, and ${skippedInvalid} invalid records.`
};

await Promise.all([
  writeJson(path.join(dataDir, "source-items.json"), nextSources),
  writeJson(path.join(dataDir, "trend-topics.json"), topics),
  writeJson(path.join(dataDir, "collection-runs.json"), [run, ...runs])
]);

console.log(
  JSON.stringify(
    {
      itemsFound: items.length,
      imported: imported.length,
      skippedDuplicates,
      skippedUnmatched,
      skippedInvalid,
      importAll,
      runId: run.id
    },
    null,
    2
  )
);

async function readJsonAbsolute(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    console.error(`Failed to read ${file}: ${error.message}`);
    return fallback;
  }
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function mapApifyItemToSource(item, collectedAt) {
  const externalId = item.id || item.shortCode || item.url || `apify_${Date.now()}`;
  const title = firstSentence(item.caption || "") || "Instagram source";
  const shortCode = item.shortCode || parseShortCode(item.url);

  return {
    id: `src_apify_instagram_${safeId(externalId)}`,
    platform: "instagram",
    externalId,
    url: item.url || "",
    authorName: item.ownerFullName || item.ownerUsername || "Unknown creator",
    authorHandle: (item.ownerUsername || "").replace(/^@+/, "").toLowerCase(),
    title,
    text: item.caption || "",
    hashtags: normalizeHashtags(item.hashtags),
    language: "en",
    region: "unknown",
    mediaType: String(item.type || "").toLowerCase() === "video" ? "video" : "post",
    publishedAt: item.timestamp || collectedAt,
    collectedAt,
    metrics: {
      views: item.videoViewCount ?? item.videoPlayCount,
      likes: item.likesCount,
      comments: item.commentsCount
    },
    thumbnailUrl: item.displayUrl || item.images?.[0],
    videoUrl: item.videoUrl,
    embedUrl: shortCode ? `https://www.instagram.com/p/${shortCode}/embed/` : undefined,
    raw: {
      source: "apify_instagram_scraper",
      inputUrl: item.inputUrl,
      item
    },
    seeded: false
  };
}

function generateTrendTopics(sourceItems, settings, timestamp) {
  const groups = new Map();
  for (const source of sourceItems) {
    const keyword = findKeyword(source, settings.keywords || []);
    if (!keyword) continue;
    const key = keyword.toLowerCase();
    const group = groups.get(key) || { keyword, sources: [] };
    group.sources.push(source);
    groups.set(key, group);
  }

  return mergeTopicsByTitle(Array.from(groups.values())
    .map((group) => {
      const sorted = [...group.sources].sort(
        (a, b) => sourceHeat(b, timestamp) - sourceHeat(a, timestamp)
      );
      const top = sorted[0];
      const narrative = buildNarrative(group.keyword, sorted);
      const engagement = average(sorted.map(engagementScore));
      const freshness = average(sorted.map((source) => freshnessScore(source, timestamp)));
      const keywordRelevance = Math.min(
        new Set(sorted.flatMap((source) => matchedKeywords(source, settings.keywords || []))).size / 3,
        1
      );
      const sourceCount = Math.min(sorted.length / 5, 1);
      const heatScore = Math.round(
        (0.45 * engagement + 0.25 * freshness + 0.2 * keywordRelevance + 0.1 * sourceCount) * 100
      );

      return {
        id: `trend_${safeId(group.keyword)}`,
        title: narrative.title,
        summary: narrative.summary,
        keywords: Array.from(new Set([group.keyword, ...top.hashtags])).slice(0, 6),
        heatScore,
        status: heatScore >= 70 ? "hot" : freshness >= 0.75 && heatScore >= 40 ? "emerging" : freshness < 0.4 ? "cooling" : "stable",
        firstSeenAt: minDate(sorted.map((source) => source.publishedAt)),
        lastSeenAt: maxDate(sorted.map((source) => source.publishedAt)),
        sourceCount: sorted.length,
        platformBreakdown: countPlatforms(sorted),
        scoreBreakdown: {
          engagement: Math.round(engagement * 100),
          freshness: Math.round(freshness * 100),
          keywordRelevance: Math.round(keywordRelevance * 100),
          sourceCount: Math.round(sourceCount * 100)
        },
        sourceIds: sorted.map((source) => source.id)
      };
    }))
    .sort((a, b) => b.heatScore - a.heatScore);
}

function countPlatforms(sources) {
  return {
    instagram: sources.filter((source) => source.platform === "instagram").length,
    x: sources.filter((source) => source.platform === "x").length,
    tiktok: sources.filter((source) => source.platform === "tiktok").length
  };
}

function mergeTopicsByTitle(topics) {
  const merged = new Map();

  for (const topic of topics) {
    const existing = merged.get(topic.title);
    if (!existing) {
      merged.set(topic.title, topic);
      continue;
    }

    const sourceIds = Array.from(new Set([...existing.sourceIds, ...topic.sourceIds]));
    const sourceCount = existing.sourceCount + topic.sourceCount;
    const instagramCount = existing.platformBreakdown.instagram + topic.platformBreakdown.instagram;

    merged.set(topic.title, {
      ...existing,
      heatScore: Math.max(existing.heatScore, topic.heatScore),
      firstSeenAt: existing.firstSeenAt < topic.firstSeenAt ? existing.firstSeenAt : topic.firstSeenAt,
      lastSeenAt: existing.lastSeenAt > topic.lastSeenAt ? existing.lastSeenAt : topic.lastSeenAt,
      sourceCount,
      platformBreakdown: { ...existing.platformBreakdown, instagram: instagramCount },
      sourceIds,
      keywords: Array.from(new Set([...existing.keywords, ...topic.keywords])).slice(0, 8),
      summary: existing.summary.replace(/^\d+ Instagram sources/, `${sourceCount} Instagram sources`)
    });
  }

  return Array.from(merged.values());
}

function buildNarrative(keyword, sources) {
  const text = sources
    .map((source) => `${source.title} ${source.text} ${source.hashtags.join(" ")}`)
    .join(" ")
    .toLowerCase();
  const sourceCount = sources.length;
  const topSource = sources[0];
  const signals = [];

  if (hasAny(text, ["aiavatar", "ai avatar", "avatar", "virtual presenter"])) signals.push("AI avatar");
  if (hasAny(text, ["ugc", "aiugc", "ai ugc", "user generated"])) signals.push("UGC");
  if (hasAny(text, ["aiads", "ai ads", "ad ", "ads", "advertising", "commercial"])) signals.push("ads");
  if (hasAny(text, ["texttovideo", "text to video", "prompt to video"])) signals.push("text-to-video");
  if (hasAny(text, ["imagetovideo", "image2video", "image to video"])) signals.push("image-to-video");
  if (hasAny(text, ["product demo", "ecommerce", "shopify", "brand"])) signals.push("product demos");
  if (hasAny(text, ["faceless", "template", "editing workflow", "workflow"])) signals.push("faceless workflow");

  if (signals.includes("AI avatar") && signals.includes("UGC") && signals.includes("ads")) {
    return {
      title: "AI Avatar UGC Ads",
      summary: `${sourceCount} Instagram sources point to AI avatar-led UGC ads: creators and brands are using virtual presenters, ad captions, and AI video workflows to make short-form marketing assets. Representative source: ${topSource.title}.`
    };
  }

  if (signals.includes("text-to-video") && signals.includes("image-to-video")) {
    return {
      title: "Text and Image to Video Workflows",
      summary: `${sourceCount} Instagram sources mention text-to-video or image-to-video creation, showing interest in turning prompts, images, and product assets into short videos. Representative source: ${topSource.title}.`
    };
  }

  if (signals.includes("product demos") && signals.includes("ads")) {
    return {
      title: "AI Product Demo Ads",
      summary: `${sourceCount} Instagram sources connect AI video with product demos, ecommerce, or ad creative, suggesting brands are testing AI-generated commercial assets. Representative source: ${topSource.title}.`
    };
  }

  if (signals.includes("faceless workflow")) {
    return {
      title: "Faceless AI Reels Workflows",
      summary: `${sourceCount} Instagram sources point to faceless short-video workflows, where AI tools and editing templates replace filming-heavy content production. Representative source: ${topSource.title}.`
    };
  }

  const readableKeyword = titleCase(keyword);
  return {
    title: `${readableKeyword} Signals`,
    summary: `${sourceCount} Instagram sources match ${readableKeyword}. The cluster is based on recurring captions, hashtags, and source count; review the evidence links to judge whether it is a meaningful creator trend. Representative source: ${topSource.title}.`
  };
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern));
}

function titleCase(value) {
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

function findKeyword(source, keywords) {
  return keywords.find((keyword) => matchesText(`${source.title} ${source.text} ${source.hashtags.join(" ")}`, keyword));
}

function matchedKeywords(source, keywords) {
  return keywords.filter((keyword) => matchesText(`${source.title} ${source.text} ${source.hashtags.join(" ")}`, keyword));
}

function matchesKeywords(item, keywords) {
  return keywords.some((keyword) => matchesText(`${item.caption || ""} ${(item.hashtags || []).join(" ")}`, keyword));
}

function matchesText(value, keyword) {
  const text = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const tokens = new Set(text.split(/\s+/).filter(Boolean));
  const compactText = text.replace(/[^a-z0-9]+/g, "");
  const normalized = keyword.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const compact = normalized.replace(/[^a-z0-9]+/g, "");

  if (!normalized.includes(" ") && compact.length <= 4) {
    return tokens.has(compact);
  }

  return text.includes(normalized) || compactText.includes(compact);
}

function engagementScore(source) {
  const views = source.metrics.views || 0;
  const likes = source.metrics.likes || 0;
  const comments = source.metrics.comments || 0;
  const shares = source.metrics.shares || 0;
  return Math.min((views + likes * 8 + comments * 20 + shares * 30) / 250000, 1);
}

function freshnessScore(source, timestamp) {
  const ageHours = Math.max((new Date(timestamp).getTime() - new Date(source.publishedAt).getTime()) / 36e5, 0);
  if (ageHours <= 24) return 1;
  if (ageHours <= 72) return 0.65;
  if (ageHours <= 168) return 0.35;
  return 0.1;
}

function sourceHeat(source, timestamp) {
  return engagementScore(source) * 0.7 + freshnessScore(source, timestamp) * 0.3;
}

function normalizeHashtags(hashtags = []) {
  return Array.from(
    new Set(
      hashtags
        .map((tag) => String(tag).trim().replace(/^#+/, "").toLowerCase())
        .filter(Boolean)
    )
  );
}

function firstSentence(text) {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 96) return cleaned;
  return `${cleaned.slice(0, 93)}...`;
}

function parseShortCode(url = "") {
  const match = url.match(/instagram\.com\/(?:p|reel)\/([^/?#]+)/);
  return match?.[1];
}

function safeId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function minDate(values) {
  return new Date(Math.min(...values.map((value) => new Date(value).getTime()))).toISOString();
}

function maxDate(values) {
  return new Date(Math.max(...values.map((value) => new Date(value).getTime()))).toISOString();
}
