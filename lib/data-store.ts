import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type {
  CollectionCandidate,
  CollectionRun,
  Settings,
  SourceItem,
  ThumbnailRepair,
  TrendTopic
} from "./types";

type AppStateKey =
  | "settings"
  | "source-items"
  | "trend-topics"
  | "collection-runs"
  | "collection-candidates"
  | "thumbnail-repairs";

const stateKeysByFileName: Record<string, AppStateKey> = {
  "settings.json": "settings",
  "source-items.json": "source-items",
  "trend-topics.json": "trend-topics",
  "collection-runs.json": "collection-runs",
  "collection-candidates.json": "collection-candidates",
  "thumbnail-repairs.json": "thumbnail-repairs"
};

const postgresUrl = process.env.DATABASE_URL?.trim();
const postgresSql = postgresUrl ? neon(postgresUrl) : null;
let postgresInit: Promise<void> | null = null;

function dataDir() {
  return process.env.AI_VIDEO_TREND_DATA_DIR || path.join(process.cwd(), "data");
}

let dataStoreQueue = Promise.resolve();

export async function withDataStoreLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = dataStoreQueue;
  let release: () => void;
  dataStoreQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    return await operation();
  } finally {
    release!();
  }
}

async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  if (postgresSql) {
    return readPostgresJson(stateKey(fileName), fallback);
  }

  try {
    const raw = await readFile(path.join(dataDir(), fileName), "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if (isMissingFileError(error)) {
      return fallback;
    }
    throw new Error(`Failed to read ${fileName}: ${errorMessage(error)}`);
  }
}

async function writeJson<T>(fileName: string, value: T): Promise<void> {
  if (postgresSql) {
    await writePostgresJson(stateKey(fileName), value);
    return;
  }

  const directory = dataDir();
  const targetPath = path.join(directory, fileName);
  const tempPath = path.join(directory, `.${fileName}.${randomUUID()}.tmp`);

  await mkdir(directory, { recursive: true });
  try {
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(tempPath, targetPath);
  } catch {
    throw new Error(`Failed to write ${fileName}.`);
  }
}

function stateKey(fileName: string): AppStateKey {
  const key = stateKeysByFileName[fileName];
  if (!key) {
    throw new Error(`No app_state key is configured for ${fileName}.`);
  }
  return key;
}

async function ensurePostgresTable(): Promise<void> {
  if (!postgresSql) return;

  postgresInit ??= postgresSql`
    CREATE TABLE IF NOT EXISTS app_state (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.then(() => undefined);

  await postgresInit;
}

async function readPostgresJson<T>(key: AppStateKey, fallback: T): Promise<T> {
  if (!postgresSql) return fallback;

  await ensurePostgresTable();
  const rows = (await postgresSql`
    SELECT value
    FROM app_state
    WHERE key = ${key}
    LIMIT 1
  `) as Array<{ value: T }>;

  if (rows.length === 0) {
    await writePostgresJson(key, fallback);
    return fallback;
  }

  return rows[0].value;
}

async function writePostgresJson<T>(key: AppStateKey, value: T): Promise<void> {
  if (!postgresSql) return;

  await ensurePostgresTable();
  await postgresSql`
    INSERT INTO app_state (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function readSettings(): Promise<Settings> {
  return readJson<Settings>("settings.json", {
    instagramHashtags: [],
    instagramCreators: [],
    tiktokHashtags: [],
    tiktokCreators: [],
    keywords: [],
    dailyCrawlLimit: 50,
    hashtagCrawlLimit: 50,
    creatorCrawlLimit: 50,
    commentsPerVideo: 30,
    minLikes: 0,
    refreshSchedule: "manual"
  });
}

export function writeSettings(settings: Settings): Promise<void> {
  return writeJson("settings.json", settings);
}

export function readSourceItems(): Promise<SourceItem[]> {
  return readJson<SourceItem[]>("source-items.json", []);
}

export function writeSourceItems(items: SourceItem[]): Promise<void> {
  return writeJson("source-items.json", items);
}

export function readCollectionCandidates(): Promise<CollectionCandidate[]> {
  return readJson<CollectionCandidate[]>("collection-candidates.json", []);
}

export function writeCollectionCandidates(
  candidates: CollectionCandidate[]
): Promise<void> {
  return writeJson("collection-candidates.json", candidates);
}

export function readTrendTopics(): Promise<TrendTopic[]> {
  return readJson<TrendTopic[]>("trend-topics.json", []);
}

export function writeTrendTopics(topics: TrendTopic[]): Promise<void> {
  return writeJson("trend-topics.json", topics);
}

export function readCollectionRuns(): Promise<CollectionRun[]> {
  return readJson<CollectionRun[]>("collection-runs.json", []);
}

export function writeCollectionRuns(runs: CollectionRun[]): Promise<void> {
  return writeJson("collection-runs.json", runs);
}

export function readThumbnailRepairs(): Promise<ThumbnailRepair[]> {
  return readJson<ThumbnailRepair[]>("thumbnail-repairs.json", []);
}

export function writeThumbnailRepairs(repairs: ThumbnailRepair[]): Promise<void> {
  return writeJson("thumbnail-repairs.json", repairs);
}
