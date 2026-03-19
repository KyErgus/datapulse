import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { getDownloadUrl, getMarketplaceDatasets } from "../lib/api"
import { useAuth } from "../context/AuthContext"
import { toDatasetCardModel } from "../lib/datasets"
import DatasetCard from "../components/DatasetCard"

export default function Marketplace() {
  const [datasets, setDatasets] = useState([])
  const [filterText, setFilterText] = useState("")
  const [sort, setSort] = useState("downloads")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const { isAuthenticated } = useAuth()

  const loadMarketplace = useCallback(async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await getMarketplaceDatasets({ sort })
      setDatasets(Array.isArray(response) ? response.map(toDatasetCardModel) : [])
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load marketplace."
      )
    } finally {
      setIsLoading(false)
    }
  }, [sort])

  useEffect(() => {
    void loadMarketplace()
  }, [loadMarketplace])

  const filteredDatasets = useMemo(() => {
    const query = filterText.trim().toLowerCase()
    if (!query) {
      return datasets
    }

    return datasets.filter((dataset) => {
      const combined = `${dataset.title} ${dataset.description} ${dataset.tags.join(" ")}`
      return combined.toLowerCase().includes(query)
    })
  }, [datasets, filterText])

  const topRowDatasets = useMemo(
    () => filteredDatasets.filter((_, index) => index % 2 === 0),
    [filteredDatasets]
  )
  const bottomRowDatasets = useMemo(
    () => filteredDatasets.filter((_, index) => index % 2 === 1),
    [filteredDatasets]
  )
  const topLoop = useMemo(() => [...topRowDatasets, ...topRowDatasets], [topRowDatasets])
  const bottomSource = bottomRowDatasets.length > 0 ? bottomRowDatasets : topRowDatasets
  const bottomLoop = useMemo(() => [...bottomSource, ...bottomSource], [bottomSource])

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <h2 className="text-center font-display text-3xl tracking-[0.08em] text-white md:text-4xl">
          MARKETPLACE
        </h2>
      </section>

      <input
        type="text"
        value={filterText}
        onChange={(event) => setFilterText(event.target.value)}
        placeholder="Filter marketplace cards..."
        className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
      />
      <select
        value={sort}
        onChange={(event) => setSort(event.target.value)}
        className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 md:w-64"
      >
        <option value="downloads">Most Downloaded</option>
        <option value="newest">Newest</option>
        <option value="trending">Trending</option>
        <option value="price_asc">Price Low</option>
        <option value="price_desc">Price High</option>
      </select>

      {error && (
        <p className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}
      {isLoading && (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300">
          Loading marketplace...
        </p>
      )}
      {!isLoading && !error && filteredDatasets.length === 0 && (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300">
          No marketplace datasets match this filter.
        </p>
      )}

      {!isLoading && filteredDatasets.length > 0 && (
        <section className="space-y-4">
          <div className="marketplace-marquee-mask rounded-2xl border border-white/10 bg-slate-900/40 py-5">
            <div className="marketplace-marquee-track-left">
              {topLoop.map((dataset, index) => (
                <div key={`top-${dataset.id}-${index}`} className="marketplace-marquee-item">
                  <DatasetCard
                    dataset={dataset}
                    restricted={!isAuthenticated}
                    actions={
                      isAuthenticated ? (
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
                      ) : (
                        <Link
                          to="/login"
                          className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-cyan-200"
                        >
                          Login
                        </Link>
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="marketplace-marquee-mask rounded-2xl border border-white/10 bg-slate-900/40 py-5">
            <div className="marketplace-marquee-track-right">
              {bottomLoop.map((dataset, index) => (
                <div key={`bottom-${dataset.id}-${index}`} className="marketplace-marquee-item">
                  <DatasetCard
                    dataset={dataset}
                    restricted={!isAuthenticated}
                    actions={
                      isAuthenticated ? (
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
                      ) : (
                        <Link
                          to="/login"
                          className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-cyan-200"
                        >
                          Login
                        </Link>
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
