"use client";

import { FormEvent, useEffect, useState } from "react";
import type {
  CollectionCandidate,
  CollectionCandidateStatus,
  ProviderStatus,
  SourceItem
} from "@/lib/types";
import { Badge } from "@/components/Badge";
import { SourceTable } from "@/components/SourceTable";
import { apiFetch } from "@/lib/client-api";

interface StatusResponse {
  instagram: ProviderStatus;
  crawlerProviders: ProviderStatus[];
  latestRun?: {
    finishedAt: string;
    message: string;
    status: string;
  };
  sourceCount: number;
  candidateCounts?: Record<CollectionCandidateStatus, number>;
}

const initialForm = {
  platform: "instagram",
  url: "",
  text: "",
  authorHandle: "",
  hashtags: "",
  views: "",
  likes: "",
  comments: "",
  shares: "",
  thumbnailUrl: "",
  videoUrl: "",
  embedUrl: ""
};

const initialXForm = {
  platform: "x",
  url: "",
  text: "",
  authorHandle: "",
  views: "",
  likes: "",
  reposts: "",
  replies: ""
};

const initialCrawlerForm = {
  platform: "instagram",
  mode: "hashtag",
  provider: "manual_import",
  query: "",
  limit: "50",
  sortBy: "latest",
  itemsJson: "",
  filterToKeywords: true
};

export default function CollectionPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [candidates, setCandidates] = useState<CollectionCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [candidateStatus, setCandidateStatus] = useState<
    CollectionCandidateStatus | "all"
  >("pending");
  const [keywordFilter, setKeywordFilter] = useState<
    "all" | "matched" | "unmatched"
  >("all");
  const [platformFilter, setPlatformFilter] = useState<
    "all" | "instagram" | "tiktok"
  >("all");
  const [seedModeFilter, setSeedModeFilter] = useState<
    "all" | "hashtag" | "keyword" | "account"
  >("all");
  const [seedQueryFilter, setSeedQueryFilter] = useState("");
  const [form, setForm] = useState(initialForm);
  const [xForm, setXForm] = useState(initialXForm);
  const [crawlerForm, setCrawlerForm] = useState(initialCrawlerForm);
  const [message, setMessage] = useState("");
  const [crawlerMessage, setCrawlerMessage] = useState("");
  const [inboxMessage, setInboxMessage] = useState("");
  const [isPromoting, setIsPromoting] = useState(false);

  async function load() {
    const [statusResponse, sourceResponse, candidateResponse] = await Promise.all([
      apiFetch("/api/collection/status"),
      apiFetch("/api/sources"),
      apiFetch(
        `/api/collection/candidates?${buildCandidateQuery({
          status: candidateStatus,
          keywordMatched: keywordFilter,
          platform: platformFilter,
          seedMode: seedModeFilter,
          seedQuery: seedQueryFilter
        }).toString()}`
      )
    ]);
    setStatus(await statusResponse.json());
    const sourceJson = await sourceResponse.json();
    const candidateJson = await candidateResponse.json();
    setSources(sourceJson.sources);
    setCandidates(candidateJson.candidates ?? []);
  }

  useEffect(() => {
    void load();
  }, [candidateStatus, keywordFilter, platformFilter, seedModeFilter, seedQueryFilter]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Saving seed source...");
    const response = await apiFetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const json = await response.json();

    if (!response.ok) {
      setMessage(json.errors?.join(" ") ?? "Seed import failed.");
      return;
    }

    setForm(initialForm);
    setMessage("Seed source stored and trends regenerated.");
    await load();
  }

  async function submitX(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Saving X seed source...");
    const response = await apiFetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(xForm)
    });
    const json = await response.json();

    if (!response.ok) {
      setMessage(json.errors?.join(" ") ?? "X seed import failed.");
      return;
    }

    setXForm(initialXForm);
    setMessage("X seed source stored and trends regenerated.");
    await load();
  }

  async function submitCrawler(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCrawlerMessage("Running crawler task...");

    let items: unknown[] | undefined;
    if (crawlerForm.provider === "manual_import") {
      if (!crawlerForm.itemsJson.trim()) {
        setCrawlerMessage(
          "Dataset JSON is empty. Paste exported records here, or switch Provider to Browser session for auto crawl."
        );
        return;
      }

      try {
        const parsed = JSON.parse(crawlerForm.itemsJson.trim());
        items = Array.isArray(parsed) ? parsed : parsed.items;
      } catch {
        setCrawlerMessage(
          "Dataset JSON is not valid JSON. Paste an array like [{\"url\":\"...\",\"text\":\"...\"}] or {\"items\":[...]}."
        );
        return;
      }

      if (!Array.isArray(items)) {
        setCrawlerMessage("Dataset JSON must be an array or an object with an items array.");
        return;
      }
    }

    const response = await apiFetch("/api/crawler/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: crawlerForm.platform,
        mode: crawlerForm.mode,
        provider: crawlerForm.provider,
        query: crawlerForm.query,
        limit: Number(crawlerForm.limit),
        sortBy: crawlerForm.sortBy,
        items,
        filterToKeywords: crawlerForm.filterToKeywords
      })
    });
    const json = await response.json();

    if (!response.ok) {
      setCrawlerMessage(
        json.errors?.join(" ") ?? json.run?.message ?? "Crawler task failed."
      );
      return;
    }

    setCrawlerForm(initialCrawlerForm);
    setCrawlerMessage(json.run?.message ?? "Crawler import stored and trends regenerated.");
    await load();
  }

  async function patchSelected(status: CollectionCandidateStatus) {
    if (selectedIds.length === 0) {
      setInboxMessage("Select candidates first.");
      return;
    }
    setInboxMessage(`Updating ${selectedIds.length} selected candidates...`);
    const response = await apiFetch("/api/collection/candidates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, status })
    });
    if (!response.ok) {
      setInboxMessage("Selected candidates update failed.");
      return;
    }
    setSelectedIds([]);
    await load();
    setInboxMessage(`Updated ${selectedIds.length} selected candidates to ${status}.`);
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) {
      setInboxMessage("Select candidates first.");
      return;
    }
    setInboxMessage(`Deleting ${selectedIds.length} selected candidates...`);
    const response = await apiFetch("/api/collection/candidates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds })
    });
    if (!response.ok) {
      setInboxMessage("Selected candidates delete failed.");
      return;
    }
    setSelectedIds([]);
    await load();
    setInboxMessage(`Deleted ${selectedIds.length} selected candidates.`);
  }

  async function promoteApproved() {
    if (isPromoting) return;
    setIsPromoting(true);
    setInboxMessage("Promoting approved candidates into dashboard...");
    try {
      const response = await apiFetch("/api/collection/promote", { method: "POST" });
      const json = await response.json();

      if (!response.ok) {
        setInboxMessage(json.error ?? "Promote approved failed.");
        return;
      }

      const promoted = json.promoted ?? 0;
      const updated = json.updated ?? 0;
      const skipped = json.skipped ?? 0;
      const totalChanged = promoted + updated;
      setInboxMessage(
        totalChanged > 0
          ? `Promoted ${promoted} approved candidates, refreshed ${updated}, skipped ${skipped}. Promoted candidates were removed from the inbox.`
          : `No approved candidates were promoted. Skipped ${skipped}. Approve candidates first, or fix duplicate / minimum-like flags.`
      );
      await load();
    } catch (error) {
      setInboxMessage(
        error instanceof Error ? error.message : "Promote approved failed."
      );
    } finally {
      setIsPromoting(false);
    }
  }

  function toggleCandidate(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id)
    );
  }

  function toggleVisibleCandidates(checked: boolean) {
    setSelectedIds(checked ? candidates.map((candidate) => candidate.id) : []);
  }

  const instagram = status?.instagram;
  const crawlerProviders = status?.crawlerProviders ?? [];
  const selectedCrawlerProvider = crawlerProviders.find(
    (provider) =>
      provider.platform === crawlerForm.platform &&
      provider.provider === crawlerForm.provider
  );
  const isManualImport = crawlerForm.provider === "manual_import";
  const isBrowserSession = crawlerForm.provider === "browser_session";
  const visibleCandidateIds = candidates.map((candidate) => candidate.id);
  const selectedVisibleCount = visibleCandidateIds.filter((id) =>
    selectedIds.includes(id)
  ).length;
  const allVisibleSelected =
    visibleCandidateIds.length > 0 &&
    selectedVisibleCount === visibleCandidateIds.length;

  return (
    <div className="editorial-subpage collection-page space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase text-muted">
          Collection validation
        </p>
        <h2 className="mt-1 text-2xl font-semibold">Instagram Sources</h2>
      </header>

      <section className="border border-line bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Instagram Graph API</p>
            <p className="mt-1 max-w-3xl text-sm text-muted">
              {instagram?.message ?? "Checking provider status..."}
            </p>
          </div>
          {instagram ? <Badge tone={instagram.status}>{instagram.status}</Badge> : null}
        </div>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <p>
            <span className="text-muted">Source count:</span>{" "}
            <span className="font-medium">{status?.sourceCount ?? "-"}</span>
          </p>
          <p>
            <span className="text-muted">Missing:</span>{" "}
            <span className="font-medium">{instagram?.missing.join(", ") || "none"}</span>
          </p>
          <p>
            <span className="text-muted">Latest run:</span>{" "}
            <span className="font-medium">{status?.latestRun?.status ?? "none"}</span>
          </p>
        </div>
      </section>

      <section className="border border-line bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Collection Inbox</h3>
            <p className="mt-1 text-sm text-muted">
              Review crawled candidates before they enter the dashboard.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {(["pending", "approved", "rejected", "duplicate"] as const).map((key) => (
              <div key={key} className="border border-line px-3 py-2">
                <p className="text-lg font-semibold">{status?.candidateCounts?.[key] ?? 0}</p>
                <p className="uppercase text-muted">{key}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <label className="flex items-center gap-2 border border-line px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              disabled={candidates.length === 0}
              onChange={(event) => toggleVisibleCandidates(event.target.checked)}
            />
            Select all visible
            {selectedVisibleCount > 0 ? (
              <span className="text-muted">({selectedVisibleCount})</span>
            ) : null}
          </label>
          <button
            type="button"
            onClick={() => void patchSelected("approved")}
            className="border border-line px-3 py-2 text-sm hover:bg-slate-50"
          >
            Approve selected
          </button>
          <button
            type="button"
            onClick={() => void patchSelected("rejected")}
            className="border border-line px-3 py-2 text-sm hover:bg-slate-50"
          >
            Reject selected
          </button>
          <button
            type="button"
            onClick={() => void patchSelected("duplicate")}
            className="border border-line px-3 py-2 text-sm hover:bg-slate-50"
          >
            Mark duplicate
          </button>
          <button
            type="button"
            onClick={() => void deleteSelected()}
            className="border border-line px-3 py-2 text-sm hover:bg-slate-50"
          >
            Delete selected
          </button>
          <button
            type="button"
            onClick={() => void promoteApproved()}
            disabled={isPromoting}
            className="border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400"
          >
            {isPromoting ? "Promoting..." : "Promote approved"}
          </button>
        </div>
        {inboxMessage ? (
          <p className="mt-3 border border-line bg-slate-50 px-3 py-2 text-sm text-muted">
            {inboxMessage}
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <select
            value={platformFilter}
            onChange={(event) =>
              setPlatformFilter(event.target.value as typeof platformFilter)
            }
            className="border border-line bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          >
            <option value="all">All platforms</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
          </select>
          <select
            value={candidateStatus}
            onChange={(event) =>
              setCandidateStatus(event.target.value as typeof candidateStatus)
            }
            className="border border-line bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="duplicate">Duplicate</option>
            <option value="all">All statuses</option>
          </select>
          <select
            value={keywordFilter}
            onChange={(event) =>
              setKeywordFilter(event.target.value as typeof keywordFilter)
            }
            className="border border-line bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          >
            <option value="all">All keyword states</option>
            <option value="matched">Keyword matched</option>
            <option value="unmatched">Unmatched</option>
          </select>
          <select
            value={seedModeFilter}
            onChange={(event) =>
              setSeedModeFilter(event.target.value as typeof seedModeFilter)
            }
            className="border border-line bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          >
            <option value="all">All seed types</option>
            <option value="hashtag">Hashtag seeds</option>
            <option value="keyword">Keyword seeds</option>
            <option value="account">Creator seeds</option>
          </select>
          <input
            value={seedQueryFilter}
            onChange={(event) => setSeedQueryFilter(event.target.value)}
            className="border border-line bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            placeholder="Seed query, e.g. tvc"
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="py-2 pr-3">
                  <input
                    aria-label="Select all visible candidates"
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={candidates.length === 0}
                    onChange={(event) =>
                      toggleVisibleCandidates(event.target.checked)
                    }
                  />
                </th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Platform</th>
                <th className="py-2 pr-3">Preview</th>
                <th className="py-2 pr-3">Caption</th>
                <th className="py-2 pr-3">Creator</th>
                <th className="py-2 pr-3">Seed</th>
                <th className="py-2 pr-3">Keyword</th>
                <th className="py-2 pr-3">Phrases</th>
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Metrics</th>
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 ? (
                <tr>
                  <td className="py-6 text-sm text-muted" colSpan={11}>
                    No candidates in this filter.
                  </td>
                </tr>
              ) : (
                candidates.map((candidate) => (
                  <tr key={candidate.id} className="border-b border-line align-top">
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(candidate.id)}
                        onChange={(event) =>
                          toggleCandidate(candidate.id, event.target.checked)
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">{candidate.status}</td>
                    <td className="py-2 pr-3">{candidate.source.platform}</td>
                    <td className="py-2 pr-3">
                      {candidate.source.thumbnailUrl ? (
                        <img
                          src={candidate.source.thumbnailUrl}
                          alt=""
                          className="h-12 w-16 object-cover"
                        />
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="max-w-xs py-2 pr-3">
                      <a
                        href={candidate.source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium hover:underline"
                      >
                        {candidate.source.title}
                      </a>
                      <p className="mt-1 line-clamp-2 text-muted">
                        {candidate.source.text}
                      </p>
                    </td>
                    <td className="py-2 pr-3">{candidate.source.authorHandle}</td>
                    <td className="py-2 pr-3">
                      {candidate.seed.mode}: {candidate.seed.query}
                    </td>
                    <td className="py-2 pr-3">
                      {candidate.review.keywordMatched
                        ? candidate.review.matchedKeywords.join(", ")
                        : "unmatched"}
                    </td>
                    <td className="max-w-xs py-2 pr-3">
                      {candidate.review.candidatePhrases.join(", ") || "-"}
                    </td>
                    <td className="py-2 pr-3">
                      {new Date(candidate.source.publishedAt).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">
                      L {candidate.source.metrics.likes ?? 0} / C{" "}
                      {candidate.source.metrics.comments ?? 0} / S{" "}
                      {candidate.source.metrics.shares ?? 0} / V{" "}
                      {candidate.source.metrics.views ?? 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <form onSubmit={submitCrawler} className="border border-line bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Social Crawler Import</h3>
            <p className="mt-1 text-sm text-muted">
              Manual import reads JSON datasets. Browser session uses a local
              Chrome/Edge instance opened with a DevTools debugging port.
            </p>
          </div>
          {crawlerMessage ? (
            <p className="text-sm text-muted">{crawlerMessage}</p>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-6">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Platform</span>
            <select
              className="w-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              value={crawlerForm.platform}
              onChange={(event) =>
                setCrawlerForm((current) => ({
                  ...current,
                  platform: event.target.value
                }))
              }
            >
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Mode</span>
            <select
              className="w-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              value={crawlerForm.mode}
              onChange={(event) =>
                setCrawlerForm((current) => ({
                  ...current,
                  mode: event.target.value
                }))
              }
            >
              <option value="hashtag">Hashtag</option>
              <option value="keyword">Keyword</option>
              <option value="account">Account</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Provider</span>
            <select
              className="w-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              value={crawlerForm.provider}
              onChange={(event) => {
                setCrawlerMessage("");
                setCrawlerForm((current) => ({
                  ...current,
                  provider: event.target.value,
                  itemsJson:
                    event.target.value === "manual_import" ? current.itemsJson : ""
                }));
              }}
            >
              <option value="manual_import">Manual import</option>
              <option value="provider_api">Provider API</option>
              <option value="official_api">Official API</option>
              <option value="browser_session">Browser session</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Query</span>
            <input
              className="w-full border border-line px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="#aivideo, ai avatar, @creator"
              value={crawlerForm.query}
              onChange={(event) =>
                setCrawlerForm((current) => ({
                  ...current,
                  query: event.target.value
                }))
              }
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Max items</span>
            <input
              className="w-full border border-line px-3 py-2 text-sm outline-none focus:border-slate-400"
              min="1"
              max="500"
              type="number"
              value={crawlerForm.limit}
              onChange={(event) =>
                setCrawlerForm((current) => ({
                  ...current,
                  limit: event.target.value
                }))
              }
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Sort rule</span>
            <select
              className="w-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              value={crawlerForm.sortBy}
              onChange={(event) =>
                setCrawlerForm((current) => ({
                  ...current,
                  sortBy: event.target.value
                }))
              }
            >
              <option value="latest">Latest</option>
              <option value="highest_heat">Highest heat</option>
              <option value="as_provided">As provided</option>
            </select>
          </label>
          <label className="text-sm md:col-span-6">
            <span className="mb-1 block font-medium">Dataset JSON</span>
            <textarea
              className="min-h-36 w-full border border-line px-3 py-2 font-mono text-xs outline-none focus:border-slate-400"
              placeholder='Example only. Paste real JSON here, e.g. [{"url":"https://www.tiktok.com/@demo/video/1","text":"AI avatar product demo"}]'
              disabled={!isManualImport}
              value={crawlerForm.itemsJson}
              onChange={(event) =>
                setCrawlerForm((current) => ({
                  ...current,
                  itemsJson: event.target.value
                }))
              }
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              disabled={!isManualImport}
              checked={crawlerForm.filterToKeywords}
              onChange={(event) =>
                setCrawlerForm((current) => ({
                  ...current,
                  filterToKeywords: event.target.checked
                }))
              }
            />
            Filter to configured trend keywords after import
          </label>
          <button
            className="border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            type="submit"
          >
            {isManualImport ? "Run import" : isBrowserSession ? "Start crawl" : "Check auto provider"}
          </button>
        </div>
        {selectedCrawlerProvider ? (
          <p className="mt-3 border border-line bg-slate-50 px-3 py-2 text-sm text-muted">
            {selectedCrawlerProvider.message}
          </p>
        ) : null}
        {isBrowserSession ? (
          <p className="mt-3 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Start Chrome/Edge with <code>--remote-debugging-port=9222</code>, log in
            to Instagram or TikTok there, then run this task. The crawler only reads
            visible page links and stops if login or verification blocks the page.
          </p>
        ) : null}
        {crawlerMessage ? (
          <p className="mt-3 border border-line bg-slate-50 px-3 py-2 text-sm text-muted">
            {crawlerMessage}
          </p>
        ) : null}
        <div className="mt-4 grid gap-2 text-xs md:grid-cols-2">
          {crawlerProviders
            .filter((provider) => provider.platform !== "x")
            .map((provider) => (
              <div
                key={`${provider.platform}_${provider.provider}`}
                className="flex items-center justify-between gap-3 border border-line px-3 py-2"
              >
                <span className="font-medium">
                  {provider.platform} / {provider.provider}
                </span>
                <Badge tone={provider.status}>{provider.status}</Badge>
              </div>
            ))}
        </div>
      </form>

      <form onSubmit={submit} className="border border-line bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">Manual Instagram Seed</h3>
          {message ? <p className="text-sm text-muted">{message}</p> : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["url", "Instagram Reel URL"],
            ["authorHandle", "Author handle"],
            ["hashtags", "Hashtags"],
            ["views", "Views"],
            ["likes", "Likes"],
            ["comments", "Comments"],
            ["shares", "Shares"],
            ["thumbnailUrl", "Thumbnail URL"],
            ["videoUrl", "Video Preview URL"],
            ["embedUrl", "Instagram Embed URL"]
          ].map(([key, label]) => (
            <label key={key} className="text-sm">
              <span className="mb-1 block font-medium">{label}</span>
              <input
                className="w-full border border-line px-3 py-2 text-sm outline-none focus:border-slate-400"
                value={form[key as keyof typeof form]}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [key]: event.target.value
                  }))
                }
              />
            </label>
          ))}
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block font-medium">Caption / Text</span>
            <textarea
              className="min-h-24 w-full border border-line px-3 py-2 text-sm outline-none focus:border-slate-400"
              value={form.text}
              onChange={(event) =>
                setForm((current) => ({ ...current, text: event.target.value }))
              }
            />
          </label>
        </div>
        <button
          className="mt-4 border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          type="submit"
        >
          Add seed source
        </button>
      </form>

      <form onSubmit={submitX} className="border border-line bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">Manual X Seed</h3>
          <p className="text-sm text-muted">Early discussion signal</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["url", "X Post URL"],
            ["authorHandle", "Author handle"],
            ["views", "Views"],
            ["likes", "Likes"],
            ["reposts", "Reposts"],
            ["replies", "Replies"]
          ].map(([key, label]) => (
            <label key={key} className="text-sm">
              <span className="mb-1 block font-medium">{label}</span>
              <input
                className="w-full border border-line px-3 py-2 text-sm outline-none focus:border-slate-400"
                value={xForm[key as keyof typeof xForm]}
                onChange={(event) =>
                  setXForm((current) => ({
                    ...current,
                    [key]: event.target.value
                  }))
                }
              />
            </label>
          ))}
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block font-medium">Post text</span>
            <textarea
              className="min-h-24 w-full border border-line px-3 py-2 text-sm outline-none focus:border-slate-400"
              value={xForm.text}
              onChange={(event) =>
                setXForm((current) => ({ ...current, text: event.target.value }))
              }
            />
          </label>
        </div>
        <button
          className="mt-4 border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          type="submit"
        >
          Add X seed source
        </button>
      </form>

      <SourceTable sources={sources.filter((source) => source.platform === "instagram")} />
      <section>
        <h3 className="mb-3 text-base font-semibold">TikTok Sources</h3>
        <SourceTable sources={sources.filter((source) => source.platform === "tiktok")} />
      </section>
      <section>
        <h3 className="mb-3 text-base font-semibold">X Sources</h3>
        <SourceTable sources={sources.filter((source) => source.platform === "x")} />
      </section>
    </div>
  );
}

function buildCandidateQuery(filters: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (!value.trim()) continue;
    params.set(key, value);
  }
  return params;
}
