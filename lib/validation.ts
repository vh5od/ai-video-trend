import type { SourceItem, SourceMetrics } from "./types";

export interface ManualSeedInput {
  url?: string;
  text?: string;
  authorName?: string;
  authorHandle?: string;
  title?: string;
  hashtags?: string | string[];
  publishedAt?: string;
  views?: string | number;
  likes?: string | number;
  comments?: string | number;
  shares?: string | number;
  thumbnailUrl?: string;
  videoUrl?: string;
  embedUrl?: string;
}

export interface ManualXSeedInput {
  url?: string;
  text?: string;
  authorName?: string;
  authorHandle?: string;
  title?: string;
  publishedAt?: string;
  views?: string | number;
  likes?: string | number;
  reposts?: string | number;
  replies?: string | number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateManualSeed(input: ManualSeedInput): ValidationResult {
  const errors: string[] = [];

  if (!input.url?.trim()) {
    errors.push("Instagram URL is required.");
  }

  if (!input.text?.trim()) {
    errors.push("Caption or text is required.");
  }

  if (input.url && !input.url.includes("instagram.com")) {
    errors.push("URL must be an Instagram link.");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function normalizeManualSeed(
  input: ManualSeedInput,
  now = new Date().toISOString()
): SourceItem {
  const validation = validateManualSeed(input);
  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  const text = input.text?.trim() ?? "";
  const url = input.url?.trim() ?? "";
  const authorHandle = normalizeHandle(input.authorHandle);

  return {
    id: `src_${stableSlug(`${url}_${now}`)}`,
    platform: "instagram",
    externalId: stableSlug(url),
    url,
    authorName: input.authorName?.trim() || authorHandle || "Unknown creator",
    authorHandle,
    title: input.title?.trim() || text.slice(0, 72),
    text,
    hashtags: normalizeHashtags(input.hashtags),
    language: "en",
    region: "unknown",
    mediaType: "reel",
    publishedAt: input.publishedAt || now,
    collectedAt: now,
    metrics: normalizeMetrics(input),
    thumbnailUrl: optionalUrl(input.thumbnailUrl),
    videoUrl: optionalUrl(input.videoUrl),
    embedUrl: optionalUrl(input.embedUrl),
    raw: {
      source: "manual_seed",
      input
    },
    seeded: true
  };
}

export function validateManualXSeed(input: ManualXSeedInput): ValidationResult {
  const errors: string[] = [];

  if (!input.url?.trim()) {
    errors.push("X post URL is required.");
  }

  if (!input.text?.trim()) {
    errors.push("Post text is required.");
  }

  if (input.url && !/(^https?:\/\/)?(x\.com|twitter\.com)\//i.test(input.url)) {
    errors.push("URL must be an X or Twitter link.");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function normalizeManualXSeed(
  input: ManualXSeedInput,
  now = new Date().toISOString()
): SourceItem {
  const validation = validateManualXSeed(input);
  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  const text = input.text?.trim() ?? "";
  const url = input.url?.trim() ?? "";
  const authorHandle = normalizeHandle(input.authorHandle);

  return {
    id: `src_x_${stableSlug(`${url}_${now}`)}`,
    platform: "x",
    externalId: stableSlug(url),
    url,
    authorName: input.authorName?.trim() || authorHandle || "Unknown X user",
    authorHandle,
    title: input.title?.trim() || text.slice(0, 72),
    text,
    hashtags: extractHashtags(text),
    language: "en",
    region: "unknown",
    mediaType: "post",
    publishedAt: input.publishedAt || now,
    collectedAt: now,
    metrics: {
      views: toNumber(input.views),
      likes: toNumber(input.likes),
      comments: toNumber(input.replies),
      shares: toNumber(input.reposts)
    },
    raw: {
      source: "manual_x_seed",
      input
    },
    seeded: true
  };
}

function normalizeHandle(handle?: string): string {
  return (handle ?? "").trim().replace(/^@+/, "").toLowerCase();
}

function normalizeHashtags(value?: string | string[]): string[] {
  const raw = Array.isArray(value) ? value.join(" ") : value ?? "";

  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((tag) => tag.trim().replace(/^#+/, "").toLowerCase())
        .filter(Boolean)
    )
  );
}

function extractHashtags(text: string): string[] {
  return Array.from(
    new Set(
      Array.from(text.matchAll(/#([a-zA-Z0-9_]+)/g)).map((match) =>
        match[1].toLowerCase()
      )
    )
  );
}

function normalizeMetrics(input: ManualSeedInput): SourceMetrics {
  return {
    views: toNumber(input.views),
    likes: toNumber(input.likes),
    comments: toNumber(input.comments),
    shares: toNumber(input.shares)
  };
}

function toNumber(value?: string | number): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function optionalUrl(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function stableSlug(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
