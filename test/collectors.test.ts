import { describe, expect, test } from "vitest";
import { getInstagramCollectorStatus } from "@/lib/collectors";

describe("Instagram collector status", () => {
  test("reports not_configured when no Instagram token is present", () => {
    const status = getInstagramCollectorStatus({});

    expect(status.status).toBe("not_configured");
    expect(status.missing).toEqual(["INSTAGRAM_ACCESS_TOKEN"]);
    expect(status.message).toContain("Manual seed mode is available");
  });

  test("reports ready when an Instagram token is configured", () => {
    const status = getInstagramCollectorStatus({
      INSTAGRAM_ACCESS_TOKEN: "token"
    });

    expect(status.status).toBe("ready");
    expect(status.missing).toEqual([]);
    expect(status.capabilities).toContain("credential_check");
  });
});
