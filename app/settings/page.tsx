"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  CRAWL_STATE_STORAGE_KEY,
  restoreCrawlState,
  serializeCrawlState
} from "@/lib/crawl-state";
import type { CollectionRun, Settings } from "@/lib/types";

interface SettingsForm {
  instagramHashtags: string;
  instagramCreators: string;
  tiktokHashtags: string;
  tiktokCreators: string;
  keywords: string;
  dailyCrawlLimit: string;
  hashtagCrawlLimit: string;
  creatorCrawlLimit: string;
  commentsPerVideo: string;
  minLikes: string;
  refreshSchedule: string;
}

interface CrawlResult {
  status: "running" | "success" | "partial" | "failed" | "paused" | "stopped";
  platform: "instagram" | "tiktok" | "all";
  tasks: number;
  itemsFound: number;
  itemsStored: number;
  runs: CollectionRun[];
  message: string;
  plannedTasks?: PlannedTask[];
}

interface PlannedTask {
  platform: "instagram" | "tiktok";
  mode: "hashtag" | "keyword" | "account";
  query: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [message, setMessage] = useState("");
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [runningPlatform, setRunningPlatform] = useState<CrawlResult["platform"] | null>(null);
  const crawlAbortRef = useRef<AbortController | null>(null);

  async function load() {
    const response = await fetch("/api/settings");
    const nextSettings = (await response.json()) as Settings;
    setSettings(nextSettings);
    setForm(toForm(nextSettings));
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const persisted = restoreCrawlState<CrawlResult>(
      window.localStorage.getItem(CRAWL_STATE_STORAGE_KEY)
    );
    if (!persisted) return;

    if (persisted.result?.status === "running") {
      setCrawlResult({
        ...persisted.result,
        status: "paused",
        message:
          "Crawl state was restored after page navigation. The previous request may have been interrupted; run again when ready."
      });
      setRunningPlatform(null);
      return;
    }

    setCrawlResult(persisted.result);
    setRunningPlatform(persisted.runningPlatform as CrawlResult["platform"] | null);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      CRAWL_STATE_STORAGE_KEY,
      serializeCrawlState({ result: crawlResult, runningPlatform })
    );
  }, [crawlResult, runningPlatform]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setMessage("Saving settings...");
    const nextSettings = await saveCurrentForm(form);
    setSettings(nextSettings);
    setForm(toForm(nextSettings));
    setMessage("Settings saved.");
  }

  async function saveCurrentForm(currentForm: SettingsForm): Promise<Settings> {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentForm)
    });

    if (!response.ok) {
      throw new Error(`Settings backend returned HTTP ${response.status}.`);
    }

    const nextSettings = (await response.json()) as Settings;
    return nextSettings;
  }

  async function runDailyCrawl(platform: CrawlResult["platform"]) {
    if (!settings || !form) {
      return;
    }

    const visibleSettings = formToSettings(form, settings);

    if (!hasCrawlSources(visibleSettings, platform)) {
      setCrawlResult({
        status: "failed",
        platform,
        tasks: 0,
        itemsFound: 0,
        itemsStored: 0,
        runs: [],
        message: `${platformLabel(platform)} has no configured hashtags or creators. Add sources below and save settings first.`
      });
      return;
    }

    setRunningPlatform(platform);
    const abortController = new AbortController();
    crawlAbortRef.current = abortController;
    setCrawlResult({
      status: "running",
      platform,
      tasks: 0,
      itemsFound: 0,
      itemsStored: 0,
      runs: [],
      message: `${platformLabel(platform)} crawl is saving current settings, then running. Keep this page open until the result appears.`
    });

    try {
      const savedSettings = await saveCurrentForm(form);
      setSettings(savedSettings);
      setForm(toForm(savedSettings));
      setMessage("Settings saved before crawl.");

      const response = await fetch("/api/crawl/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
        signal: abortController.signal
      });
      const json = await readJsonResponse(response);

      if (!response.ok) {
        setCrawlResult({
          status: "failed",
          platform,
          tasks: 0,
          itemsFound: 0,
          itemsStored: 0,
          runs: [],
          message:
            json.error ??
            `Daily crawl backend returned HTTP ${response.status}. ${json.message ?? ""}`.trim()
        });
        return;
      }

      const runs = (json.runs ?? []) as CollectionRun[];
      const failedRuns = runs.filter((run) => run.status === "failed");
      const status =
        runs.length === 0
          ? "failed"
          : failedRuns.length === 0
            ? "success"
            : failedRuns.length === runs.length
              ? "failed"
              : "partial";
      setCrawlResult({
        status,
        platform: json.platform ?? platform,
        tasks: json.tasks ?? runs.length,
        itemsFound: json.itemsFound ?? 0,
        itemsStored: json.itemsStored ?? 0,
        runs,
        plannedTasks: json.plannedTasks ?? [],
        message:
          runs.length === 0
            ? `${platformLabel(platform)} has no configured crawl tasks. Add hashtags or creators below and save settings first.`
            : status === "success"
            ? `${platformLabel(platform)} crawl finished.`
            : status === "partial"
              ? `${platformLabel(platform)} crawl finished with some failed tasks.`
              : `${platformLabel(platform)} crawl failed.`
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setCrawlResult({
        status: "failed",
        platform,
        tasks: 0,
        itemsFound: 0,
        itemsStored: 0,
        runs: [],
        message:
          error instanceof Error
            ? error.message
            : "Daily crawl failed because the request could not complete."
      });
    } finally {
      if (crawlAbortRef.current === abortController) {
        crawlAbortRef.current = null;
      }
      setRunningPlatform(null);
    }
  }

  function stopDailyCrawl(status: "paused" | "stopped") {
    if (!runningPlatform) return;
    crawlAbortRef.current?.abort();
    const platform = runningPlatform;
    setRunningPlatform(null);
    setCrawlResult((current) => ({
      status,
      platform,
      tasks: current?.tasks ?? 0,
      itemsFound: current?.itemsFound ?? 0,
      itemsStored: current?.itemsStored ?? 0,
      runs: current?.runs ?? [],
      plannedTasks: current?.plannedTasks,
      message:
        status === "paused"
          ? `${platformLabel(platform)} crawl paused from this page. Start it again when you are ready.`
          : `${platformLabel(platform)} crawl stopped from this page.`
    }));
  }

  if (!settings || !form) {
    return <p className="text-sm text-muted">Loading settings...</p>;
  }

  const canRunInstagram = hasCrawlSources(settings, "instagram");
  const canRunTikTok = hasCrawlSources(settings, "tiktok");
  const canRunAll = hasCrawlSources(settings, "all");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted">Local config</p>
          <h2 className="mt-1 text-2xl font-semibold">Settings</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <CrawlButton
            disabled={runningPlatform !== null || !canRunInstagram}
            loading={runningPlatform === "instagram"}
            label={canRunInstagram ? "Run Instagram" : "Instagram not configured"}
            onClick={() => runDailyCrawl("instagram")}
          />
          <CrawlButton
            disabled={runningPlatform !== null || !canRunTikTok}
            loading={runningPlatform === "tiktok"}
            label={canRunTikTok ? "Run TikTok" : "TikTok not configured"}
            onClick={() => runDailyCrawl("tiktok")}
          />
          <CrawlButton
            disabled={runningPlatform !== null || !canRunAll}
            loading={runningPlatform === "all"}
            label="Run All"
            onClick={() => runDailyCrawl("all")}
          />
          {runningPlatform ? (
            <>
              <button
                type="button"
                onClick={() => stopDailyCrawl("paused")}
                className="border border-amber-700 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
              >
                Pause
              </button>
              <button
                type="button"
                onClick={() => stopDailyCrawl("stopped")}
                className="border border-red-800 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-100"
              >
                Stop
              </button>
            </>
          ) : null}
        </div>
      </header>

      {crawlResult ? <CrawlResultPanel result={crawlResult} /> : null}

      <form onSubmit={save} className="space-y-5">
        <section className="border border-line bg-white p-4">
          <h3 className="text-base font-semibold">Daily crawl sources</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <TextList
              label="Instagram hashtags"
              value={form.instagramHashtags}
              onChange={(value) => setForm({ ...form, instagramHashtags: value })}
              placeholder="aivideo&#10;aitools"
            />
            <TextList
              label="Instagram creators"
              value={form.instagramCreators}
              onChange={(value) => setForm({ ...form, instagramCreators: value })}
              placeholder="runwayml&#10;heygen_official"
            />
            <TextList
              label="TikTok hashtags"
              value={form.tiktokHashtags}
              onChange={(value) => setForm({ ...form, tiktokHashtags: value })}
              placeholder="aivideo&#10;aitools"
            />
            <TextList
              label="TikTok creators"
              value={form.tiktokCreators}
              onChange={(value) => setForm({ ...form, tiktokCreators: value })}
              placeholder="runwayml&#10;heygen"
            />
          </div>
        </section>

        <section className="border border-line bg-white p-4">
          <h3 className="text-base font-semibold">Integration keywords</h3>
          <div className="mt-3">
            <TextList
              label="Video and comment keywords"
              value={form.keywords}
              onChange={(value) => setForm({ ...form, keywords: value })}
              placeholder="AI video&#10;Runway&#10;AI avatar"
            />
          </div>
        </section>

        <section className="border border-line bg-white p-4">
          <h3 className="text-base font-semibold">Crawl limits</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Videos per hashtag</span>
              <input
                className="w-full border border-line px-3 py-2 text-sm outline-none focus:border-slate-400"
                min="1"
                type="number"
                value={form.hashtagCrawlLimit}
                onChange={(event) =>
                  setForm({
                    ...form,
                    hashtagCrawlLimit: event.target.value,
                    dailyCrawlLimit: event.target.value
                  })
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Videos per creator</span>
              <input
                className="w-full border border-line px-3 py-2 text-sm outline-none focus:border-slate-400"
                min="1"
                type="number"
                value={form.creatorCrawlLimit}
                onChange={(event) =>
                  setForm({ ...form, creatorCrawlLimit: event.target.value })
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Comments per video</span>
              <input
                className="w-full border border-line px-3 py-2 text-sm outline-none focus:border-slate-400"
                min="0"
                type="number"
                value={form.commentsPerVideo}
                onChange={(event) =>
                  setForm({ ...form, commentsPerVideo: event.target.value })
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Minimum likes</span>
              <input
                className="w-full border border-line px-3 py-2 text-sm outline-none focus:border-slate-400"
                min="0"
                type="number"
                value={form.minLikes}
                onChange={(event) =>
                  setForm({ ...form, minLikes: event.target.value })
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Refresh schedule</span>
              <input
                className="w-full border border-line px-3 py-2 text-sm outline-none focus:border-slate-400"
                value={form.refreshSchedule}
                onChange={(event) =>
                  setForm({ ...form, refreshSchedule: event.target.value })
                }
              />
            </label>
          </div>
        </section>

        <div className="flex items-center justify-between">
          {message ? <p className="text-sm text-muted">{message}</p> : <span />}
          <button
            className="border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            type="submit"
          >
            Save settings
          </button>
        </div>
      </form>
    </div>
  );
}

function CrawlResultPanel({ result }: { result: CrawlResult }) {
  const failedRuns = result.runs.filter((run) => run.status === "failed");
  const readyRuns = result.runs.filter((run) => run.status !== "failed");
  const tone =
    result.status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : result.status === "partial"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : result.status === "running"
          ? "border-blue-200 bg-blue-50 text-blue-950"
          : result.status === "paused" || result.status === "stopped"
            ? "border-slate-200 bg-slate-50 text-slate-950"
          : "border-red-200 bg-red-50 text-red-950";

  return (
    <section className={`border p-4 ${tone}`} aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{result.message}</h3>
          <p className="mt-1 text-sm">
            {result.status === "running"
              ? `Opening configured ${platformLabel(result.platform)} crawl tasks.`
              : result.status === "paused" || result.status === "stopped"
                ? `Last crawl status: ${result.status}.`
              : `${readyRuns.length} tasks completed, ${failedRuns.length} failed.`}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <Metric label="Tasks" value={result.tasks} />
          <Metric label="Candidates" value={result.itemsFound} />
          <Metric label="Stored" value={result.itemsStored} />
        </div>
      </div>
      {failedRuns.length > 0 ? (
        <div className="mt-4 border-t border-current/20 pt-3">
          <p className="text-sm font-semibold">Failed tasks</p>
          <div className="mt-2 space-y-2">
            {failedRuns.slice(0, 6).map((run) => (
              <div key={run.id} className="bg-white/50 px-3 py-2 text-sm">
                <p className="font-medium">
                  {run.platform} / {run.provider}
                </p>
                <p className="mt-1">{run.message}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {result.plannedTasks && result.plannedTasks.length > 0 ? (
        <div className="mt-4 border-t border-current/20 pt-3">
          <p className="text-sm font-semibold">Executed tasks</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {result.plannedTasks.map((task) => (
              <span
                key={`${task.platform}_${task.mode}_${task.query}`}
                className="border border-current/20 bg-white/50 px-2 py-1 text-xs"
              >
                {task.platform} / {task.mode} / {task.query}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CrawlButton({
  disabled,
  loading,
  label,
  onClick
}: {
  disabled: boolean;
  loading: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {loading ? "Running..." : label}
    </button>
  );
}

function platformLabel(platform: CrawlResult["platform"]): string {
  if (platform === "instagram") {
    return "Instagram";
  }
  if (platform === "tiktok") {
    return "TikTok";
  }
  return "All platforms";
}

function hasCrawlSources(settings: Settings, platform: CrawlResult["platform"]): boolean {
  const hasInstagram =
    settings.instagramHashtags.length > 0 || settings.instagramCreators.length > 0;
  const hasTikTok = settings.tiktokHashtags.length > 0 || settings.tiktokCreators.length > 0;

  if (platform === "instagram") {
    return hasInstagram;
  }
  if (platform === "tiktok") {
    return hasTikTok;
  }
  return hasInstagram || hasTikTok;
}

async function readJsonResponse(response: Response): Promise<Record<string, any>> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as Record<string, any>;
  }

  const text = await response.text();
  return {
    error: `Daily crawl backend returned HTTP ${response.status}.`,
    message: text.trim().slice(0, 180)
  };
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 border border-current/20 bg-white/50 px-3 py-2">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs uppercase">{label}</p>
    </div>
  );
}

function TextList({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <textarea
        className="min-h-32 w-full border border-line px-3 py-2 text-sm outline-none focus:border-slate-400"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function toForm(settings: Settings): SettingsForm {
  return {
    instagramHashtags: settings.instagramHashtags.join("\n"),
    instagramCreators: settings.instagramCreators.join("\n"),
    tiktokHashtags: settings.tiktokHashtags.join("\n"),
    tiktokCreators: settings.tiktokCreators.join("\n"),
    keywords: settings.keywords.join("\n"),
    dailyCrawlLimit: String(settings.dailyCrawlLimit),
    hashtagCrawlLimit: String(settings.hashtagCrawlLimit ?? settings.dailyCrawlLimit),
    creatorCrawlLimit: String(settings.creatorCrawlLimit ?? settings.dailyCrawlLimit),
    commentsPerVideo: String(settings.commentsPerVideo),
    minLikes: String(settings.minLikes),
    refreshSchedule: settings.refreshSchedule
  };
}

function formToSettings(form: SettingsForm, fallback: Settings): Settings {
  return {
    instagramHashtags: normalizeList(form.instagramHashtags),
    instagramCreators: normalizeList(form.instagramCreators),
    tiktokHashtags: normalizeList(form.tiktokHashtags),
    tiktokCreators: normalizeList(form.tiktokCreators),
    keywords: normalizeList(form.keywords),
    dailyCrawlLimit: normalizePositiveNumber(form.dailyCrawlLimit, fallback.dailyCrawlLimit),
    hashtagCrawlLimit: normalizePositiveNumber(
      form.hashtagCrawlLimit,
      fallback.hashtagCrawlLimit ?? fallback.dailyCrawlLimit
    ),
    creatorCrawlLimit: normalizePositiveNumber(
      form.creatorCrawlLimit,
      fallback.creatorCrawlLimit ?? fallback.dailyCrawlLimit
    ),
    commentsPerVideo: normalizePositiveNumber(form.commentsPerVideo, fallback.commentsPerVideo),
    minLikes: normalizeNonNegativeNumber(form.minLikes, fallback.minLikes),
    refreshSchedule: form.refreshSchedule || fallback.refreshSchedule
  };
}

function normalizeList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function normalizePositiveNumber(value: string, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }
  return Math.floor(number);
}

function normalizeNonNegativeNumber(value: string, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }
  return Math.floor(number);
}
