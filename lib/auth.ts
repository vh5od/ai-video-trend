type AuthEnv = Readonly<Record<string, string | undefined>>;

const protectedPagePrefixes = ["/settings", "/collection"];
const protectedApiPrefixes = [
  "/api/collect",
  "/api/collection",
  "/api/crawl",
  "/api/crawler",
  "/api/import",
  "/api/settings"
];

export function isProtectedRoute(request: Request): boolean {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  if (protectedPagePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  if (protectedApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  if (pathname === "/api/sources" && method !== "GET") {
    return true;
  }

  return false;
}

export function isAdminAuthorized(
  request: Request,
  env: AuthEnv = process.env
): boolean {
  const password = env.ADMIN_PASSWORD;
  if (!password) {
    return true;
  }

  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Basic\s+(.+)$/i);
  if (!match) {
    return false;
  }

  try {
    const decoded = decodeBase64(match[1]);
    const separator = decoded.indexOf(":");
    const providedPassword = separator >= 0 ? decoded.slice(separator + 1) : "";
    return providedPassword === password;
  } catch {
    return false;
  }
}

function decodeBase64(value: string): string {
  if (typeof globalThis.atob === "function") {
    return globalThis.atob(value);
  }
  return Buffer.from(value, "base64").toString("utf8");
}
