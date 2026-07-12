import Link from "next/link";
import type { FollowUpCandidate } from "@/lib/dashboard";
import { formatCompactNumber, sourceHeatScore } from "@/lib/dashboard";
import { Badge } from "./Badge";
import { SourceActionLink } from "./SourceActionLink";

export function FollowUpCandidates({
  candidates
}: {
  candidates: FollowUpCandidate[];
}) {
  const topCandidates = candidates.slice(0, 8);

  return (
    <section className="data-surface border border-line bg-white">
      <div className="border-b border-line px-3 py-2">
        <h3 className="text-sm font-semibold text-ink">Follow-up candidates</h3>
        <p className="text-xs text-muted">
          Sources worth reviewing for repeatable formats and fast recreation.
        </p>
      </div>
      <div className="divide-y divide-line">
        {topCandidates.map((candidate, index) => (
          <article
            key={candidate.source.id}
            className="motion-row grid gap-3 px-3 py-3 lg:grid-cols-[40px_minmax(0,1.1fr)_minmax(0,1.4fr)_120px]"
          >
            <div className="text-sm font-semibold text-slate-700">
              {index + 1}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={candidate.source.platform}>
                  {candidate.source.platform}
                </Badge>
                <span className="text-sm font-medium text-ink">
                  {candidate.source.authorName || "Unknown author"}
                </span>
                <span className="text-xs text-muted">
                  @{candidate.source.authorHandle || "unknown"}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-700">
                {candidate.source.title || candidate.source.text || "Untitled source"}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <SourceActionLink
                  className="text-xs"
                  href={candidate.source.url}
                />
                {candidate.trend ? (
                  <Link
                    className="font-medium text-slate-700 underline-offset-2 hover:underline"
                    href={`/trends/${candidate.trend.id}`}
                  >
                    {candidate.trend.title}
                  </Link>
                ) : (
                  <span className="text-muted">No mapped trend</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Reasons</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {candidate.reasons.length > 0 ? (
                  candidate.reasons.map((reason) => (
                    <Badge key={reason}>{reason}</Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted">No reasons provided</span>
                )}
              </div>
            </div>
            <div className="text-sm">
              <p className="text-xs font-semibold uppercase text-muted">Score</p>
              <p className="mt-1 font-semibold text-ink">
                {formatCompactNumber(candidate.score)}
              </p>
              <p className="mt-2 text-xs font-semibold uppercase text-muted">
                Heat
              </p>
              <p className="mt-1 font-semibold text-ink">
                {formatCompactNumber(sourceHeatScore(candidate.source))}
              </p>
            </div>
          </article>
        ))}
        {topCandidates.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted">
            No follow-up candidates in this window.
          </div>
        ) : null}
      </div>
    </section>
  );
}
