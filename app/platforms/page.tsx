import { Badge } from "@/components/Badge";

const rows = [
  {
    platform: "Instagram",
    status: "active",
    role: "First validation source for Reels and visual AI video formats."
  },
  {
    platform: "X",
    status: "manual_seed",
    role: "Manual early-signal discussion source. MCP/API adapter is the next integration."
  },
  {
    platform: "TikTok",
    status: "not_configured",
    role: "Future short-video heat validation adapter."
  }
];

export default function PlatformsPage() {
  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase text-muted">Provider scope</p>
        <h2 className="mt-1 text-2xl font-semibold">Platforms</h2>
      </header>
      <div className="border border-line bg-white">
        <table className="text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Platform</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Role</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.platform} className="border-t border-line">
                <td className="px-3 py-3 font-medium">{row.platform}</td>
                <td className="px-3 py-3">
                  <Badge tone={row.status === "active" ? "ready" : "not_configured"}>
                    {row.status}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-muted">{row.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
