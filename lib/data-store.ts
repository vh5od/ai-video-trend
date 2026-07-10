import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  CollectionCandidate,
  CollectionRun,
  Settings,
  SourceItem,
  TrendTopic
} from "./types";

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
