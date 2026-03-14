import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { getDownloadUrl, getExploreDatasets } from "../lib/api"
import { toDatasetCardModel } from "../lib/datasets"
import DatasetCard from "../components/DatasetCard"

export default function Explore() {
  const [datasets, setDatasets] = useState([])
  const [search, setSearch] = useState("")
  const [tags, setTags] = useState("")
  const [priceMin, setPriceMin] = useState("")
  const [priceMax, setPriceMax] = useState("")
  const [sort, setSort] = useState("downloads")
  const [limit, setLimit] = useState(20)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const loadExplore = useCallback(async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await getExploreDatasets({
        search: search.trim(),
        tags: tags.trim(),
        priceMin: priceMin === "" ? undefined : Number(priceMin),
        priceMax: priceMax === "" ? undefined : Number(priceMax),
        sort,
        limit,
      })
      setDatasets(Array.isArray(response) ? response.map(toDatasetCardModel) : [])
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load explore datasets."
      )
    } finally {
      setIsLoading(false)
    }
  }, [search, tags, priceMin, priceMax, sort, limit])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadExplore()
    }, 250)

    return () => {
      clearTimeout(timeout)
    }
  }, [loadExplore])

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Discovery</p>
        <h2 className="font-display text-2xl text-white">Explore Top Datasets</h2>
        <p className="mt-1 text-sm text-slate-300">
          Powered by <code>/datasets/explore</code> with search and limit controls.
        </p>
      </section>

      <section className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:grid-cols-2 xl:grid-cols-6">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by dataset name..."
          className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 xl:col-span-2"
        />
        <input
          type="text"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="Tags (comma separated)"
          className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={priceMin}
          onChange={(event) => setPriceMin(event.target.value)}
          placeholder="Min price"
          className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={priceMax}
          onChange={(event) => setPriceMax(event.target.value)}
          placeholder="Max price"
          className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
        >
          <option value="downloads">Most Downloaded</option>
          <option value="newest">Newest</option>
          <option value="trending">Trending</option>
          <option value="price_asc">Price Low</option>
          <option value="price_desc">Price High</option>
        </select>
        <select
          value={limit}
          onChange={(event) => setLimit(Number(event.target.value))}
          className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
        >
          <option value={12}>Top 12</option>
          <option value={20}>Top 20</option>
          <option value={36}>Top 36</option>
          <option value={60}>Top 60</option>
        </select>
      </section>

      {error && (
        <p className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}
      {isLoading && (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300">
          Loading explore datasets...
        </p>
      )}

      {!isLoading && !error && datasets.length === 0 && (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300">
          No datasets found for this query.
        </p>
      )}

      {!isLoading && datasets.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {datasets.map((dataset) => (
            <DatasetCard
              key={dataset.id}
              dataset={dataset}
              actions={
                <>
                  <Link
                    to={`/dataset/${dataset.id}`}
                    className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-cyan-200"
                  >
                    View
                  </Link>
                  <a
                    href={getDownloadUrl(dataset.id)}
                    className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/20"
                  >
                    Download
                  </a>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
