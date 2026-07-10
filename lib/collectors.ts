import type { ProviderStatus } from "./types";

export interface CollectorEnv {
  INSTAGRAM_ACCESS_TOKEN?: string;
}

export function getInstagramCollectorStatus(
  env: Readonly<Record<string, string | undefined>> = process.env
): ProviderStatus {
  const hasToken = Boolean(env.INSTAGRAM_ACCESS_TOKEN?.trim());

  if (!hasToken) {
    return {
      platform: "instagram",
      provider: "instagram_graph_api",
      status: "not_configured",
      message:
        "Instagram API credentials are not configured. Manual seed mode is available for validation.",
      capabilities: ["manual_seed", "credential_check"],
      missing: ["INSTAGRAM_ACCESS_TOKEN"]
    };
  }

  return {
    platform: "instagram",
    provider: "instagram_graph_api",
    status: "ready",
    message:
      "Instagram access token is configured. Capability checks can run before collection.",
    capabilities: ["manual_seed", "credential_check", "api_collection_adapter"],
    missing: []
  };
}
