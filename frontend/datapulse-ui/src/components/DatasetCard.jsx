import { formatNumber } from "../lib/datasets"

export default function DatasetCard({
  dataset,
  onOpen,
  actions,
  compact = false,
}) {
  return (
    <article className="group rounded-2xl border border-white/10 bg-slate-900/50 p-4 shadow-[0_10px_35px_rgba(2,6,23,0.45)] transition hover:-translate-y-0.5 hover:border-cyan-300/40">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-white">
          {dataset.title}
        </h3>
        <span className="rounded-full bg-cyan-300/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-100">
          {dataset.datasetType}
        </span>
      </div>

      <p className={`text-sm text-slate-300 ${compact ? "clamp-2" : "clamp-3"}`}>
        {dataset.description}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {dataset.tags.length > 0 ? (
          dataset.tags.slice(0, 4).map((tag) => (
            <span
              key={`${dataset.id}-${tag}`}
              className="rounded-md bg-white/10 px-2 py-1 text-xs text-slate-200"
            >
              #{tag}
            </span>
          ))
        ) : (
          <span className="rounded-md bg-white/5 px-2 py-1 text-xs text-slate-400">
            #untagged
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-950/60 p-3 text-xs text-slate-300">
        <div>
          <p className="text-slate-400">Owner</p>
          <p className="font-semibold text-white">{dataset.owner}</p>
        </div>
        <div>
          <p className="text-slate-400">Price</p>
          <p className="font-semibold text-white">
            {dataset.raw?.is_paid ? `$${dataset.raw?.price}` : "Free"}
          </p>
        </div>
        <div>
          <p className="text-slate-400">Size</p>
          <p className="font-semibold text-white">{dataset.sizeLabel}</p>
        </div>
        <div>
          <p className="text-slate-400">Downloads</p>
          <p className="font-semibold text-white">{formatNumber(dataset.downloadCount)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-slate-400">Updated</p>
          <p className="font-semibold text-white">{dataset.createdAtLabel}</p>
        </div>
      </div>

      {dataset.raw?.preview_image && (
        <img
          src={dataset.raw.preview_image}
          alt={`${dataset.title} preview`}
          className="mt-3 h-32 w-full rounded-xl object-cover"
        />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {onOpen && (
          <button
            type="button"
            onClick={() => onOpen(dataset)}
            className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-900 transition hover:bg-cyan-200"
          >
            Open
          </button>
        )}
        {actions}
      </div>
    </article>
  )
}
