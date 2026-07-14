type DeploymentEnv = Readonly<Record<string, string | undefined>>;

const localOnlyPagePrefixes = ["/collection", "/platforms", "/settings"];

export function isVercelEnvironment(env: DeploymentEnv = process.env): boolean {
  return env.VERCEL === "1" || Boolean(env.VERCEL_ENV);
}

export function isLocalCdpUrl(value: string | undefined): boolean {
  const url = value?.trim();
  if (!url) return true;

  try {
    const parsed = new URL(url);
    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  } catch {
    return url.includes("127.0.0.1") || url.includes("localhost");
  }
}

export function isCloudBrowserSessionUnavailable(
  env: DeploymentEnv = process.env
): boolean {
  return isVercelEnvironment(env) && isLocalCdpUrl(env.BROWSER_CDP_URL);
}

export function browserSessionUnavailableMessage(): string {
  return "Browser-session crawling is local-only on Vercel. Run crawling from your local machine with DATABASE_URL set to the same Postgres database.";
}

export function isLocalWorkspaceHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

export function isLocalOnlyPagePath(pathname: string): boolean {
  return localOnlyPagePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
