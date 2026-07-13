import type { CrawlerTask } from "./types";

export interface BrowserSessionRawItem {
  url: string;
  text: string;
  authorId?: string;
  authorName?: string;
  authorHandle?: string;
  publishedAt?: string;
  hashtags?: string[];
  thumbnailUrl?: string;
  videoUrl?: string;
  views?: number;
  likes?: number;
  commentsCount?: number;
  shares?: number;
  comments?: string[];
}

export interface BrowserDetailMetadataInput {
  platform: CrawlerTask["platform"];
  url: string;
  title?: string;
  description?: string;
  image?: string;
  video?: string;
  bodyText?: string;
  publishedAt?: string;
  engagementText?: string;
  views?: number;
  likes?: number;
  commentsCount?: number;
  shares?: number;
  comments?: string[];
  authorCandidates?: BrowserAuthorCandidate[];
  profileLinks?: BrowserProfileLink[];
  fallbackThumbnailUrl?: string;
}

interface BrowserAuthorCandidate {
  id?: string;
  handle?: string;
  name?: string;
}

interface BrowserProfileLink {
  href?: string;
  text?: string;
}

export interface BrowserSessionClient {
  collectVisibleItems(input: {
    url: string;
    platform: CrawlerTask["platform"];
    limit: number;
  }): Promise<BrowserSessionRawItem[]>;
}

export interface CollectBrowserSessionItemsInput {
  task: CrawlerTask;
  client?: BrowserSessionClient;
  cdpUrl?: string;
}

export interface CollectBrowserSessionItemsResult {
  url: string;
  items: BrowserSessionRawItem[];
}

interface CdpTarget {
  id: string;
  webSocketDebuggerUrl?: string;
}

interface CdpResponse {
  id?: number;
  result?: {
    result?: {
      value?: unknown;
    };
  };
  error?: {
    message?: string;
  };
}

export function buildBrowserSessionUrl(task: CrawlerTask): string {
  const query =
    task.mode === "hashtag"
      ? task.query.replace(/^#+/, "").replace(/\s+/g, "").toLowerCase()
      : task.mode === "account"
        ? task.query.replace(/^@+/, "").trim()
        : task.query.trim();

  if (task.platform === "instagram") {
    if (task.mode === "hashtag") {
      return `https://www.instagram.com/explore/tags/${encodeURIComponent(query)}/`;
    }
    if (task.mode === "account") {
      return `https://www.instagram.com/${encodeURIComponent(query)}/`;
    }
    return `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(query)}`;
  }

  if (task.mode === "hashtag") {
    return `https://www.tiktok.com/tag/${encodeURIComponent(query)}`;
  }
  if (task.mode === "account") {
    return `https://www.tiktok.com/@${encodeURIComponent(query)}`;
  }
  return `https://www.tiktok.com/search?${new URLSearchParams({ q: query }).toString()}`;
}

export async function collectBrowserSessionItems({
  task,
  client = new CdpBrowserSessionClient(),
  cdpUrl
}: CollectBrowserSessionItemsInput): Promise<CollectBrowserSessionItemsResult> {
  const url = buildBrowserSessionUrl(task);
  const browserClient =
    cdpUrl && client instanceof CdpBrowserSessionClient
      ? new CdpBrowserSessionClient(cdpUrl)
      : client;
  const items = await browserClient.collectVisibleItems({
    url,
    platform: task.platform,
    limit: task.limit
  });

  return { url, items };
}

export class CdpBrowserSessionClient implements BrowserSessionClient {
  private readonly cdpUrl: string;
  private readonly commandTimeoutMs = 15000;

  constructor(cdpUrl = process.env.BROWSER_CDP_URL || "http://127.0.0.1:9222") {
    this.cdpUrl = cdpUrl.replace(/\/+$/, "");
  }

  async collectVisibleItems({
    url,
    platform,
    limit
  }: {
    url: string;
    platform: CrawlerTask["platform"];
    limit: number;
  }): Promise<BrowserSessionRawItem[]> {
    const target = await this.createTarget(url);
    if (!target.webSocketDebuggerUrl) {
      throw new Error("Browser CDP target did not expose a WebSocket debugger URL.");
    }

    const connection = await withTimeout(
      CdpConnection.connect(target.webSocketDebuggerUrl),
      this.commandTimeoutMs,
      "Timed out connecting to browser CDP WebSocket."
    );
    try {
      await connection.send("Page.enable", undefined, this.commandTimeoutMs);
      await connection.send("Runtime.enable", undefined, this.commandTimeoutMs);
      await connection.send("Page.navigate", { url }, this.commandTimeoutMs);
      await wait(3500);
      await connection.send(
        "Runtime.evaluate",
        {
          expression: autoScrollScript(),
          awaitPromise: true,
          returnByValue: true
        },
        this.commandTimeoutMs
      );
      const response = await connection.send(
        "Runtime.evaluate",
        {
          expression: extractLinksScript(platform, limit),
          returnByValue: true
        },
        this.commandTimeoutMs
      );
      const value = response.result?.result?.value;
      const links = Array.isArray(value) ? normalizeBrowserLinks(value) : [];
      if (links.length === 0) {
        const blockerResponse = await connection.send(
          "Runtime.evaluate",
          {
            expression: browserSessionBlockScript(platform),
            returnByValue: true
          },
          this.commandTimeoutMs
        );
        const blocker = blockerResponse.result?.result?.value;
        const message =
          blocker && typeof blocker === "object"
            ? detectBrowserSessionBlock(
                blocker as {
                  platform: CrawlerTask["platform"];
                  currentUrl?: string;
                  title?: string;
                  bodyText?: string;
                }
              )
            : undefined;
        throw new Error(
          message ||
            `No visible ${platform} post/video links found. Confirm the connected browser is logged in and the page is not blocked by verification.`
        );
      }
      const items: BrowserSessionRawItem[] = [];

      for (const link of links) {
        await connection.send("Page.navigate", { url: link.url }, this.commandTimeoutMs);
        await wait(platform === "instagram" ? 4500 : 1800);
        const detailResponse = await connection.send(
          "Runtime.evaluate",
          {
            expression: extractDetailScript(link.url, link.thumbnailUrl),
            returnByValue: true
          },
          this.commandTimeoutMs
        );
        const detail = detailResponse.result?.result?.value;
        const parsed = parseBrowserDetailMetadata({
          platform,
          url: link.url,
          ...(detail && typeof detail === "object" ? (detail as Record<string, string>) : {}),
          fallbackThumbnailUrl: link.thumbnailUrl
        });
        items.push(parsed);
      }

      return normalizeBrowserItems(items);
    } finally {
      connection.close();
      await this.closeTarget(target.id);
    }
  }

  private async createTarget(url: string): Promise<CdpTarget> {
    let response: Response;
    try {
      response = await withTimeout(
        fetch(`${this.cdpUrl}/json/new?${new URLSearchParams({ url }).toString()}`, {
          method: "PUT"
        }),
        this.commandTimeoutMs,
        "Timed out creating browser CDP target."
      );
    } catch {
      throw new Error(
        `Browser session is not connected. Start Chrome/Edge with --remote-debugging-port=9222 or set BROWSER_CDP_URL.`
      );
    }

    if (!response.ok) {
      throw new Error(
        `Browser CDP endpoint returned HTTP ${response.status}. Check BROWSER_CDP_URL.`
      );
    }

    return (await response.json()) as CdpTarget;
  }

  private async closeTarget(id: string): Promise<void> {
    try {
      await withTimeout(
        fetch(`${this.cdpUrl}/json/close/${encodeURIComponent(id)}`),
        5000,
        "Timed out closing browser CDP target."
      );
    } catch {
      // Best effort cleanup; collection result is more important than target close.
    }
  }
}

class CdpConnection {
  private nextId = 1;
  private pending = new Map<
    number,
    {
      resolve: (value: CdpResponse) => void;
      reject: (error: Error) => void;
    }
  >();

  private constructor(private readonly socket: WebSocket) {
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as CdpResponse;
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message || "CDP command failed."));
      } else {
        pending.resolve(message);
      }
    });
  }

  static connect(url: string): Promise<CdpConnection> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener("open", () => resolve(new CdpConnection(socket)), {
        once: true
      });
      socket.addEventListener(
        "error",
        () => reject(new Error("Failed to connect to browser CDP WebSocket.")),
        { once: true }
      );
    });
  }

  send(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs = 15000
  ): Promise<CdpResponse> {
    const id = this.nextId;
    this.nextId += 1;
    const payload = JSON.stringify({ id, method, params });
    return withTimeout(new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(payload);
    }), timeoutMs, `Timed out waiting for browser command ${method}.`);
  }

  close(): void {
    this.socket.close();
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeout);
  });
}

function normalizeBrowserItems(value: unknown[]): BrowserSessionRawItem[] {
  const items: BrowserSessionRawItem[] = [];

  for (const entry of value) {
    const record = entry && typeof entry === "object" ? (entry as BrowserSessionRawItem) : null;
    if (!record?.url || !record.text) continue;
    items.push({
      url: record.url,
      text: record.text,
      authorName: record.authorName,
      authorId: record.authorId,
      authorHandle: record.authorHandle,
      thumbnailUrl: record.thumbnailUrl,
      videoUrl: record.videoUrl,
      views: cleanNumber(record.views),
      likes: cleanNumber(record.likes),
      commentsCount: cleanNumber(record.commentsCount),
      shares: cleanNumber(record.shares),
      publishedAt: record.publishedAt,
      comments: Array.isArray(record.comments)
        ? record.comments.filter((comment) => typeof comment === "string" && comment.trim())
        : undefined
    });
  }

  return items;
}

function normalizeBrowserLinks(value: unknown[]): Array<{ url: string; thumbnailUrl?: string }> {
  const links: Array<{ url: string; thumbnailUrl?: string }> = [];

  for (const entry of value) {
    const record = entry && typeof entry === "object" ? (entry as { url?: unknown; thumbnailUrl?: unknown }) : null;
    if (typeof record?.url !== "string" || !record.url.trim()) continue;
    links.push({
      url: record.url.trim(),
      thumbnailUrl:
        typeof record.thumbnailUrl === "string" && record.thumbnailUrl.trim()
          ? record.thumbnailUrl.trim()
          : undefined
    });
  }

  return links;
}

function extractLinksScript(platform: CrawlerTask["platform"], limit: number): string {
  const linkPattern =
    platform === "instagram"
      ? "instagram.com/(p|reel)/"
      : "tiktok.com/@[^/]+/video/";

  return `(() => {
    const linkPattern = new RegExp(${JSON.stringify(linkPattern)}, "i");
    const anchors = Array.from(document.querySelectorAll("a[href]"));
    const seen = new Set();
    const items = [];
    for (const anchor of anchors) {
      const href = anchor.href || "";
      if (!linkPattern.test(href) || seen.has(href)) continue;
      seen.add(href);
      const container = anchor.closest("article, div") || anchor;
      const img = container.querySelector("img");
      const video = container.querySelector("video");
      items.push({
        url: href,
        thumbnailUrl: img?.currentSrc || img?.src || video?.poster
      });
      if (items.length >= ${JSON.stringify(limit)}) break;
    }
    return items;
  })()`;
}

function extractDetailScript(url: string, fallbackThumbnailUrl?: string): string {
  const shortcode = url.match(/instagram\.com\/(?:p|reel)\/([^/?#]+)/i)?.[1] || "";
  return `(() => {
    const meta = (name) =>
      document.querySelector('meta[property="' + name + '"]')?.content ||
      document.querySelector('meta[name="' + name + '"]')?.content ||
      "";
    const parseCompactNumber = (value) => {
      const match = String(value || "").replace(/,/g, "").match(/([\\d.]+)\\s*([KMB])?/i);
      if (!match) return undefined;
      const number = Number(match[1]);
      if (!Number.isFinite(number)) return undefined;
      const suffix = (match[2] || "").toUpperCase();
      const multiplier = suffix === "B" ? 1000000000 : suffix === "M" ? 1000000 : suffix === "K" ? 1000 : 1;
      return Math.round(number * multiplier);
    };
    const firstMetricText = (selectors) => {
      for (const selector of selectors) {
        for (const node of document.querySelectorAll(selector)) {
          const text = [
            node.getAttribute?.("aria-label"),
            node.textContent
          ].filter(Boolean).join(" ").replace(/\\s+/g, " ").trim();
          if (text) return text;
        }
      }
      return "";
    };
    const decodeJsonString = (value) => {
      try { return JSON.parse('"' + value.replace(/"/g, '\\\\"') + '"'); }
      catch { return value; }
    };
    const scriptText = Array.from(document.scripts).map((script) => script.textContent || "").join("\\n");
    const shortcode = ${JSON.stringify(shortcode)};
    const shortIndex = shortcode ? scriptText.indexOf(shortcode) : -1;
    const focusedScriptText =
      shortIndex >= 0
        ? scriptText.slice(Math.max(0, shortIndex - 80000), shortIndex + 80000)
        : scriptText.slice(0, 180000);
    const authorCandidates = [];
    const pushAuthor = (handle, name) => {
      const normalizedHandle = (handle || "").trim().replace(/^@+/, "");
      const normalizedName = (name || "").trim();
      if (!normalizedHandle || /^(p|reel|explore|accounts|direct|stories)$/i.test(normalizedHandle)) return;
      if (/\\s/.test(normalizedHandle)) return;
      if (authorCandidates.some((candidate) => candidate.handle === normalizedHandle)) return;
      authorCandidates.push({ handle: normalizedHandle, name: normalizedName || normalizedHandle });
    };
    for (const match of focusedScriptText.matchAll(/"owner"\\s*:\\s*\\{[\\s\\S]{0,3000}?"username"\\s*:\\s*"([^"]+)"[\\s\\S]{0,3000}?(?:"full_name"\\s*:\\s*"([^"]*)")?/g)) {
      pushAuthor(decodeJsonString(match[1]), decodeJsonString(match[2] || ""));
    }
    for (const match of focusedScriptText.matchAll(/"username"\\s*:\\s*"([^"]+)"[\\s\\S]{0,800}?"full_name"\\s*:\\s*"([^"]*)"/g)) {
      pushAuthor(decodeJsonString(match[1]), decodeJsonString(match[2] || ""));
    }
    for (const match of focusedScriptText.matchAll(/"owner_username"\\s*:\\s*"([^"]+)"/g)) {
      pushAuthor(decodeJsonString(match[1]), "");
    }
    const metricFromScript = (names) => {
      for (const name of names) {
        const pattern = new RegExp('"' + name + '"\\\\s*:\\\\s*"?([\\\\d,.]+\\\\s*[KMB]?)"?', "i");
        const match = focusedScriptText.match(pattern) || scriptText.match(pattern);
        const value = match ? parseCompactNumber(match[1]) : undefined;
        if (value !== undefined) return value;
      }
      return undefined;
    };
    const publishedAtFromScript = () => {
      const timestampMatch =
        focusedScriptText.match(/"taken_at_timestamp"\\s*:\\s*(\\d{9,13})/) ||
        focusedScriptText.match(/"taken_at"\\s*:\\s*(\\d{9,13})/) ||
        focusedScriptText.match(/"createTime"\\s*:\\s*"?([\\d]{9,13})"?/);
      if (!timestampMatch) return "";
      const raw = Number(timestampMatch[1]);
      if (!Number.isFinite(raw)) return "";
      const epochMs = raw > 9999999999 ? raw : raw * 1000;
      const date = new Date(epochMs);
      return Number.isNaN(date.getTime()) ? "" : date.toISOString();
    };
    const metricFromText = (text) => parseCompactNumber(text);
    const likeText = firstMetricText([
      '[data-e2e="like-count"]',
      '[data-e2e="browse-like-count"]',
      'button[aria-label*="like" i]',
      'button[title*="like" i]'
    ]);
    const commentText = firstMetricText([
      '[data-e2e="comment-count"]',
      '[data-e2e="browse-comment-count"]',
      'button[aria-label*="comment" i]',
      'button[title*="comment" i]'
    ]);
    const shareText = firstMetricText([
      '[data-e2e="share-count"]',
      '[data-e2e="browse-share-count"]',
      'button[aria-label*="share" i]',
      'button[title*="share" i]'
    ]);
    const viewText = firstMetricText([
      '[data-e2e="video-views"]',
      '[data-e2e="play-count"]',
      '[data-e2e="browse-play-count"]'
    ]);
    const profileLinks = Array.from(document.querySelectorAll("a[href]"))
      .map((anchor) => ({ href: anchor.href || "", text: (anchor.innerText || anchor.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim() }))
      .filter((link) => /^https:\\/\\/www\\.instagram\\.com\\/[^/?#]+\\/?(?:[?#].*)?$/.test(link.href))
      .filter((link) => !/\\/(p|reel|explore|accounts|direct|stories)\\//i.test(link.href))
      .slice(0, 12);
    const visibleComments = Array.from(document.querySelectorAll("ul li, article ul li, [role='dialog'] li"))
      .map((node) => node.innerText || "")
      .map((text) => text.replace(/\\s+/g, " ").trim())
      .filter((text) => text.length > 12 && text.length < 500)
      .slice(0, 20);
    return {
      url: ${JSON.stringify(url)},
      title: document.title || meta("og:title") || "",
      description: meta("og:description") || meta("description") || "",
      image: meta("og:image") || ${JSON.stringify(fallbackThumbnailUrl || "")},
      video: meta("og:video") || document.querySelector("video")?.currentSrc || document.querySelector("video")?.src || "",
      bodyText: (document.body?.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 12000),
      engagementText: [likeText, commentText, shareText, viewText].filter(Boolean).join(" "),
      publishedAt: publishedAtFromScript(),
      likes: metricFromScript(["diggCount", "likeCount", "likes"]) ?? metricFromText(likeText),
      commentsCount: metricFromScript(["commentCount", "commentsCount", "comments"]) ?? metricFromText(commentText),
      shares: metricFromScript(["shareCount", "shares"]) ?? metricFromText(shareText),
      views: metricFromScript(["playCount", "viewCount", "views"]) ?? metricFromText(viewText),
      comments: visibleComments,
      authorCandidates,
      profileLinks
    };
  })()`;
}

export function parseBrowserDetailMetadata(input: BrowserDetailMetadataInput): BrowserSessionRawItem {
  const description = cleanText(input.description || "");
  const title = cleanText(input.title || "");
  const bodyText = cleanText(input.bodyText || "");
  const engagementText = cleanText(input.engagementText || "");
  const combined = cleanText([description, title, bodyText, engagementText].filter(Boolean).join(" "));
  const urlHandle = input.platform === "tiktok" ? parseTikTokHandle(input.url) : undefined;
  const instagramAuthor =
    input.platform === "instagram"
      ? findInstagramAuthor(input.authorCandidates, input.profileLinks)
      : {};
  const parsed =
    input.platform === "instagram"
      ? parseInstagramMetadata(description, title, combined, instagramAuthor)
      : parseTikTokMetadata(description, title, combined, urlHandle);
  const text =
    meaningfulCaption(input.platform, parsed.text) ||
    meaningfulCaption(input.platform, description) ||
    meaningfulCaption(input.platform, title) ||
    meaningfulCaption(input.platform, bodyText);

  return {
    url: input.url,
    text,
    authorName: parsed.authorName || parsed.authorHandle || urlHandle,
    authorId: parsed.authorId,
    authorHandle: parsed.authorHandle || urlHandle,
    publishedAt:
      normalizePublishedAt(input.publishedAt) ||
      parsed.publishedAt ||
      (input.platform === "tiktok" ? publishedAtFromTikTokVideoId(input.url) : undefined),
    thumbnailUrl: input.image || input.fallbackThumbnailUrl,
    videoUrl: input.video,
    views: cleanNumber(input.views) ?? parsed.views,
    likes: cleanNumber(input.likes) ?? parsed.likes,
    commentsCount: cleanNumber(input.commentsCount) ?? parsed.commentsCount,
    shares: cleanNumber(input.shares) ?? parsed.shares,
    comments: Array.isArray(input.comments)
      ? input.comments.filter((comment) => typeof comment === "string" && comment.trim())
      : undefined
  };
}

function parseInstagramMetadata(
  description: string,
  title: string,
  combined: string,
  structuredAuthor: { authorId?: string; authorName?: string; authorHandle?: string } = {}
): {
  authorId?: string;
  authorName?: string;
  authorHandle?: string;
  publishedAt?: string;
  text: string;
  views?: number;
  likes?: number;
  commentsCount?: number;
  shares?: number;
} {
  const structured = extractInstagramStructuredMetadata(combined);
  const authorFromDescription = description.match(/-\s*([^@:\n]+?)\s+on\s+/i)?.[1]?.trim();
  const localized = parseInstagramLocalizedAuthorAndDate(description);
  const authorFromTitle =
    title.match(/(?:photo|video|reel)\s+by\s+([^(@|\n]+?)(?:\s+on\s+Instagram|$)/i)?.[1]?.trim() ||
    title.match(/^([^(@|\n]+?)\s+on\s+Instagram/i)?.[1]?.trim();
  const quoted = description.match(/:\s*["“]([^"”]+)["”]/)?.[1]?.trim();
  const fallbackAuthorHandle = normalizeParsedHandle(
    localized.author || authorFromDescription || authorFromTitle
  );
  return {
    authorName:
      structuredAuthor.authorName ||
      structured.authorName ||
      localized.author ||
      authorFromDescription ||
      authorFromTitle,
    authorId: structuredAuthor.authorId || structured.authorId,
    authorHandle: structuredAuthor.authorHandle || structured.authorHandle || fallbackAuthorHandle,
    publishedAt: structured.publishedAt || localized.publishedAt,
    text: quoted || removeEngagementPrefix(description),
    ...extractEngagement(combined)
  };
}

function parseInstagramLocalizedAuthorAndDate(description: string): {
  author?: string;
  publishedAt?: string;
} {
  const match = description.match(
    /-\s*([a-z0-9._]+)\s*[，,]\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*:/i
  );
  if (!match) return {};

  const month = monthIndex(match[2]);
  const day = Number(match[3]);
  const year = Number(match[4]);
  const publishedAt =
    month === undefined || !Number.isFinite(day) || !Number.isFinite(year)
      ? undefined
      : new Date(Date.UTC(year, month, day)).toISOString();

  return {
    author: match[1],
    publishedAt
  };
}

function monthIndex(value: string): number | undefined {
  const index = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december"
  ].indexOf(value.toLowerCase());

  return index >= 0 ? index : undefined;
}

function findInstagramAuthor(
  authorCandidates: BrowserAuthorCandidate[] | undefined,
  profileLinks: BrowserProfileLink[] | undefined
): { authorId?: string; authorName?: string; authorHandle?: string } {
  const candidate = authorCandidates?.find((entry) => normalizeParsedHandle(entry.handle));
  if (candidate) {
    const handle = normalizeParsedHandle(candidate.handle);
    return {
      authorId: candidate.id,
      authorName: candidate.name?.trim() || handle,
      authorHandle: handle
    };
  }

  return {};
}

function parseTikTokMetadata(
  description: string,
  title: string,
  combined: string,
  fallbackHandle?: string
): {
  authorId?: string;
  authorName?: string;
  authorHandle?: string;
  publishedAt?: string;
  text: string;
  views?: number;
  likes?: number;
  commentsCount?: number;
  shares?: number;
} {
  const creatorMatch = combined.match(/from\s+(.+?)\s+\(@([^)]+)\)/i);
  const quoted = description.match(/:\s*["“]([^"”]+)["”]/)?.[1]?.trim();
  return {
    authorId: undefined,
    authorName: creatorMatch?.[1]?.trim() || fallbackHandle,
    authorHandle: normalizeParsedHandle(creatorMatch?.[2] || fallbackHandle),
    publishedAt: publishedAtFromTikTokVideoId(combined) || publishedAtFromTikTokVideoId(fallbackHandle || ""),
    text: quoted || meaningfulCaption("tiktok", title) || removeEngagementPrefix(description),
    ...extractEngagement(combined)
  };
}

export function detectBrowserSessionBlock(input: {
  platform: CrawlerTask["platform"];
  currentUrl?: string;
  title?: string;
  bodyText?: string;
}): string | undefined {
  const text = cleanText([input.currentUrl, input.title, input.bodyText].filter(Boolean).join(" "));
  const platformLabel = input.platform === "instagram" ? "Instagram" : "TikTok";

  if (
    /\b(log in|login|sign in|signin)\b/i.test(text) ||
    /\/(?:login|accounts\/login)(?:[/?#]|$)/i.test(text)
  ) {
    return `${platformLabel} browser session is not logged in. Open ${platformLabel} in the connected browser, finish login, then retry.`;
  }

  if (
    /\b(checkpoint|challenge|verification|verify|security check|confirm you own this account|unusual activity)\b/i.test(
      text
    )
  ) {
    return `${platformLabel} browser session is blocked by login or verification. Finish the verification in the connected browser, then retry.`;
  }

  return undefined;
}

function extractInstagramStructuredMetadata(text: string): {
  authorId?: string;
  authorName?: string;
  authorHandle?: string;
  publishedAt?: string;
} {
  const ownerBlock = text.match(/"owner"\s*:\s*\{[\s\S]{0,3000}?\}/)?.[0] || "";
  const username =
    ownerBlock.match(/"username"\s*:\s*"([^"]+)"/)?.[1] ||
    text.match(/"owner_username"\s*:\s*"([^"]+)"/)?.[1];
  const fullName = ownerBlock.match(/"full_name"\s*:\s*"([^"]*)"/)?.[1];
  const id = ownerBlock.match(/"id"\s*:\s*"?([^",}]+)"?/)?.[1];
  const timestamp =
    text.match(/"taken_at_timestamp"\s*:\s*(\d{9,13})/)?.[1] ||
    text.match(/"taken_at"\s*:\s*(\d{9,13})/)?.[1];

  return {
    authorName: decodeJsonish(fullName || "") || normalizeParsedHandle(username),
    authorHandle: normalizeParsedHandle(decodeJsonish(username || "")),
    publishedAt: timestamp ? timestampToIso(timestamp) : undefined
  };
}

function normalizePublishedAt(value?: string): string | undefined {
  if (!value) return undefined;
  if (/^\d{9,13}$/.test(value)) {
    return timestampToIso(value);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function timestampToIso(value: string): string | undefined {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return undefined;
  const epochMs = raw > 9999999999 ? raw : raw * 1000;
  const date = new Date(epochMs);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function publishedAtFromTikTokVideoId(value: string): string | undefined {
  const id = value.match(/\/video\/(\d+)/)?.[1] || value.match(/\b(\d{18,20})\b/)?.[1];
  if (!id) return undefined;
  try {
    const seconds = Number(BigInt(id) >> BigInt(32));
    const date = new Date(seconds * 1000);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  } catch {
    return undefined;
  }
}

function decodeJsonish(value: string): string {
  if (!value) return "";
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`) as string;
  } catch {
    return value;
  }
}

function extractEngagement(text: string) {
  return {
    views: metricFromText(text, ["views", "view", "plays", "play"]),
    likes: metricFromText(text, ["likes", "like"]),
    commentsCount: metricFromText(text, ["comments", "comment"]),
    shares: metricFromText(text, ["shares", "share"])
  };
}

function metricFromText(text: string, labels: string[]): number | undefined {
  const labelPattern = labels.join("|");
  const labelBeforeNumber = text.match(
    new RegExp(`\\b(${labelPattern})\\b\\s*[:：\\-]?\\s*([\\d][\\d,.]*)\\s*([KMB])?`, "i")
  );
  if (labelBeforeNumber) {
    return parseCompactNumber(`${labelBeforeNumber[2]}${labelBeforeNumber[3] || ""}`);
  }

  const numberBeforeLabel = Array.from(
    text.matchAll(new RegExp(`([\\d][\\d,.]*)\\s*([KMB])?\\s*\\b(${labelPattern})\\b`, "gi"))
  );
  for (const match of numberBeforeLabel) {
    const value = parseCompactNumber(`${match[1]}${match[2] || ""}`);
    if (value !== undefined && value > 0) {
      return value;
    }
  }

  return undefined;
}

function parseCompactNumber(value: string): number | undefined {
  const match = value.trim().match(/^([\d,.]+)\s*([KMB])?$/i);
  if (!match) return undefined;
  const base = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) return undefined;
  const multiplier = match[2]?.toUpperCase() === "B" ? 1_000_000_000 : match[2]?.toUpperCase() === "M" ? 1_000_000 : match[2]?.toUpperCase() === "K" ? 1_000 : 1;
  return Math.round(base * multiplier);
}

function removeEngagementPrefix(value: string): string {
  return meaningfulCaption(
    "instagram",
    value
      .replace(/^[\d,.]+\s*[KMB]?\s+likes?,?\s*/i, "")
      .replace(/^[\d,.]+\s*[KMB]?\s+comments?\s*[-.]?\s*/i, "")
      .replace(/^\s*-\s*[^:]+:\s*/i, "")
  );
}

function meaningfulCaption(platform: CrawlerTask["platform"], value: string): string {
  const cleaned = cleanCaption(value);
  if (!cleaned || isGenericPlatformText(platform, cleaned)) {
    return "";
  }
  return cleaned;
}

function isGenericPlatformText(platform: CrawlerTask["platform"], value: string): boolean {
  const normalized = cleanText(value).toLowerCase();
  if (platform === "tiktok") {
    return [
      "tiktok - make your day",
      "tiktok make your day",
      "make your day"
    ].includes(normalized);
  }
  return ["instagram", "instagram photos and videos"].includes(normalized);
}

function cleanCaption(value: string): string {
  return cleanText(value)
    .replace(/\s*\|\s*Instagram\s*$/i, "")
    .replace(/\s*\|\s*TikTok\s*$/i, "")
    .replace(/^TikTok video from .+?:\s*/i, "")
    .replace(/^Instagram photo by .+?:\s*/i, "")
    .replace(/^Instagram video by .+?:\s*/i, "")
    .replace(/^["“]|["”]$/g, "")
    .trim();
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeParsedHandle(value?: string): string | undefined {
  const handle = value?.trim().replace(/^@+/, "").toLowerCase();
  if (!handle || ["p", "reel", "explore", "tag"].includes(handle)) return undefined;
  return handle;
}

function parseTikTokHandle(url: string): string | undefined {
  return normalizeParsedHandle(url.match(/tiktok\.com\/@([^/]+)/i)?.[1]);
}

function parseInstagramProfileHandle(url: string): string | undefined {
  const handle = url.match(/instagram\.com\/([^/?#]+)\/?(?:[?#].*)?$/i)?.[1];
  return normalizeParsedHandle(handle);
}

function cleanNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function autoScrollScript(): string {
  return `new Promise((resolve) => {
    let steps = 0;
    const timer = setInterval(() => {
      window.scrollBy(0, Math.floor(window.innerHeight * 0.8));
      steps += 1;
      if (steps >= 4) {
        clearInterval(timer);
        resolve(true);
      }
    }, 500);
  })`;
}

function browserSessionBlockScript(platform: CrawlerTask["platform"]): string {
  return `(() => ({
    platform: ${JSON.stringify(platform)},
    currentUrl: location.href,
    title: document.title || "",
    bodyText: (document.body?.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 3000)
  }))()`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
