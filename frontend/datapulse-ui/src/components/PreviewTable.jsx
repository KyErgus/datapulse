export default function PreviewTable({ preview }) {
  if (!preview || preview.error) {
    return (
      <p className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        {preview?.error || "Preview unavailable."}
      </p>
    )
  }

  if (!Array.isArray(preview.columns) || preview.columns.length === 0) {
    return (
      <p className="rounded-xl border border-slate-300/20 bg-slate-500/10 px-4 py-3 text-sm text-slate-300">
        No preview columns found.
      </p>
    )
  }

  return (
    <div className="overflow-auto rounded-xl border border-white/10 bg-slate-950/60">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-800/80 text-xs uppercase tracking-wider text-slate-300">
          <tr>
            {preview.columns.map((column) => (
              <th key={column} className="px-3 py-2 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.isArray(preview.preview) &&
            preview.preview.map((row, index) => (
              <tr key={`${index}-${preview.columns[0] ?? "row"}`} className="border-t border-white/5">
                {preview.columns.map((column) => (
                  <td
                    key={`${index}-${column}`}
                    className="max-w-[260px] truncate px-3 py-2 text-slate-200"
                    title={row?.[column] === undefined ? "" : `${row[column]}`}
                  >
                    {row?.[column] === undefined ? "—" : `${row[column]}`}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
