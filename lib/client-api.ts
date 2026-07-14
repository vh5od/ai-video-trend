type LocationLike = Pick<Location, "host" | "protocol">;

export function apiUrl(path: string, locationLike = currentLocation()): string {
  if (!locationLike || !path.startsWith("/") || isAbsoluteUrl(path)) {
    return path;
  }

  return `${locationLike.protocol}//${locationLike.host}${path}`;
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}

function currentLocation(): LocationLike | undefined {
  return typeof window === "undefined" ? undefined : window.location;
}

function isAbsoluteUrl(value: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(value);
}
