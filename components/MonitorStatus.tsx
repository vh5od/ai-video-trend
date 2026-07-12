import type { TrendStatus } from "@/lib/types";

export function MonitorStatus({
  status,
  prefix,
  className = ""
}: {
  status: TrendStatus;
  prefix?: string;
  className?: string;
}) {
  return (
    <span className={`monitor-status ${className}`.trim()} data-status={status}>
      {prefix ? <span className="monitor-status-prefix">{prefix}</span> : null}
      <span className="monitor-status-dot" aria-hidden="true" />
      <span>{status.replace("_", "-")}</span>
    </span>
  );
}