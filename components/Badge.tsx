import type { CollectorStatus, TrendStatus } from "@/lib/types";

const toneMap: Record<string, string> = {
  hot: "border-red-200 bg-red-50 text-red-700",
  emerging: "border-emerald-200 bg-emerald-50 text-emerald-700",
  stable: "border-slate-200 bg-slate-50 text-slate-700",
  cooling: "border-amber-200 bg-amber-50 text-amber-700",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  not_configured: "border-slate-200 bg-slate-50 text-slate-700",
  partial: "border-amber-200 bg-amber-50 text-amber-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  instagram: "border-pink-200 bg-pink-50 text-pink-700",
  tiktok: "border-cyan-200 bg-cyan-50 text-cyan-700",
  x: "border-slate-300 bg-slate-100 text-slate-800"
};

export function Badge({
  children,
  tone = "stable"
}: {
  children: React.ReactNode;
  tone?: TrendStatus | CollectorStatus | "instagram" | "x" | "tiktok";
}) {
  const className =
    toneMap[tone] ?? "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}
