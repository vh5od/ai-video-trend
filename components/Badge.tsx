import type { CollectorStatus, TrendStatus } from "@/lib/types";

export function Badge({
  children,
  tone = "stable"
}: {
  children: React.ReactNode;
  tone?: TrendStatus | CollectorStatus | "instagram" | "x" | "tiktok";
}) {
  return (
    <span className="ui-tag" data-tone={tone}>
      {children}
    </span>
  );
}