export function MetricStrip({
  items
}: {
  items: Array<{ label: string; value: string | number }>;
}) {
  return (
    <div className="metric-strip dashboard-metrics overflow-hidden">
      {items.map((item) => (
        <div key={item.label} className="metric-cell px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{item.label}</p>
          <p className="mono-data mt-2 text-[25px] font-semibold leading-none text-ink">{item.value}</p>
          <div className="mt-3 h-px w-8 bg-blue-500/70" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
