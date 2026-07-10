export function MetricStrip({
  items
}: {
  items: Array<{ label: string; value: string | number }>;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 border-y border-line bg-white py-3 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="px-4">
          <p className="text-xs font-medium uppercase text-muted">{item.label}</p>
          <p className="mt-1 text-xl font-semibold text-ink">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
