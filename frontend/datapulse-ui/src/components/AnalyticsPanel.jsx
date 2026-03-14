import { formatNumber } from "../lib/datasets"

function MetricCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
      <p className="text-xs uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  )
}

export default function AnalyticsPanel({ analytics }) {
  if (!analytics || analytics.error) {
    return (
      <p className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        {analytics?.error || "Analytics unavailable."}
      </p>
    )
  }

  const columnCount = Array.isArray(analytics.columns) ? analytics.columns.length : 0
  const missingEntries =
    analytics.missing_values && typeof analytics.missing_values === "object"
      ? Object.values(analytics.missing_values).reduce((total, value) => {
          const numericValue = Number(value)
          return total + (Number.isNaN(numericValue) ? 0 : numericValue)
        }, 0)
      : 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard label="Rows" value={formatNumber(analytics.rows ?? 0)} />
        <MetricCard label="Columns" value={formatNumber(columnCount)} />
        <MetricCard label="Missing Cells" value={formatNumber(missingEntries)} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
          <p className="mb-2 text-xs uppercase tracking-widest text-slate-400">Column Types</p>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs text-slate-200">
            {JSON.stringify(analytics.column_types ?? {}, null, 2)}
          </pre>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
          <p className="mb-2 text-xs uppercase tracking-widest text-slate-400">Numeric Stats</p>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs text-slate-200">
            {JSON.stringify(analytics.numeric_stats ?? {}, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
