import type {
  DashboardPlatformFilter,
  DashboardSortKey,
  DashboardTimePreset
} from "@/lib/dashboard";
import { useI18n } from "@/components/AppShell";

interface DashboardControlsProps {
  timePreset: DashboardTimePreset;
  platform: DashboardPlatformFilter;
  sortKey: DashboardSortKey;
  customStart: string;
  customEnd: string;
  onTimePresetChange: (value: DashboardTimePreset) => void;
  onPlatformChange: (value: DashboardPlatformFilter) => void;
  onSortKeyChange: (value: DashboardSortKey) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
}

export function DashboardControls({
  timePreset,
  platform,
  sortKey,
  customStart,
  customEnd,
  onTimePresetChange,
  onPlatformChange,
  onSortKeyChange,
  onCustomStartChange,
  onCustomEndChange
}: DashboardControlsProps) {
  const { dictionary } = useI18n();
  const controlText = dictionary.controls;
  const timePresets: Array<{ label: string; value: DashboardTimePreset }> = [
    { label: controlText.today, value: "today" },
    { label: controlText.yesterday, value: "yesterday" },
    { label: controlText.thisWeek, value: "this_week" },
    { label: controlText.lastWeek, value: "last_week" },
    { label: controlText.last7Days, value: "last_7_days" },
    { label: controlText.last30Days, value: "last_30_days" },
    { label: controlText.customRange, value: "custom" }
  ];
  const platforms: Array<{ label: string; value: DashboardPlatformFilter }> = [
    { label: controlText.all, value: "all" },
    { label: "TikTok", value: "tiktok" },
    { label: "Instagram", value: "instagram" }
  ];
  const sortKeys: Array<{ label: string; value: DashboardSortKey }> = [
    { label: controlText.heat, value: "heat" },
    { label: controlText.latestPublished, value: "latest" },
    { label: controlText.collected, value: "collected" },
    { label: controlText.likes, value: "likes" },
    { label: controlText.comments, value: "comments" },
    { label: controlText.shares, value: "shares" }
  ];

  return (
    <section className="border border-line bg-white px-3 py-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(160px,0.7fr)_minmax(160px,0.7fr)]">
        <fieldset>
          <legend className="mb-1 text-xs font-semibold uppercase text-muted">
            {controlText.timeWindow}
          </legend>
          <div className="flex flex-wrap gap-1">
            {timePresets.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`border px-2.5 py-1 text-xs font-medium ${
                  timePreset === option.value
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-line bg-white text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => onTimePresetChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <ControlSelect
          label={controlText.platform}
          value={platform}
          options={platforms}
          onChange={onPlatformChange}
        />

        <ControlSelect
          label={controlText.sort}
          value={sortKey}
          options={sortKeys}
          onChange={onSortKeyChange}
        />
      </div>

      {timePreset === "custom" ? (
        <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:max-w-xl">
          <label className="text-xs font-semibold uppercase text-muted">
            {controlText.start}
            <input
              type="date"
              className="mt-1 block w-full border border-line bg-white px-2 py-1.5 text-sm font-normal text-ink"
              value={customStart}
              onChange={(event) => onCustomStartChange(event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold uppercase text-muted">
            {controlText.end}
            <input
              type="date"
              className="mt-1 block w-full border border-line bg-white px-2 py-1.5 text-sm font-normal text-ink"
              value={customEnd}
              onChange={(event) => onCustomEndChange(event.target.value)}
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}

function ControlSelect<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="text-xs font-semibold uppercase text-muted">
      {label}
      <select
        className="mt-1 block w-full border border-line bg-white px-2 py-1.5 text-sm font-normal text-ink"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
