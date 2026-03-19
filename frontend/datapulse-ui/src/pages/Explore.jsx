import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { getDownloadUrl, getExploreDatasets } from "../lib/api"
import { useAuth } from "../context/AuthContext"
import { toDatasetCardModel } from "../lib/datasets"
import DatasetCard from "../components/DatasetCard"

export default function Explore() {
  const [datasets, setDatasets] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [isOpeningShelby, setIsOpeningShelby] = useState(false)
  const { isAuthenticated } = useAuth()

  const loadExplore = useCallback(async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await getExploreDatasets({
        sort: "downloads",
        limit: 40,
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
  }, [])

  useEffect(() => {
    void loadExplore()
  }, [loadExplore])

  useEffect(() => {
    const timer = setInterval(() => {
      void loadExplore()
    }, 30000)
    return () => {
      clearInterval(timer)
    }
  }, [loadExplore])

  const loopedDatasets = useMemo(() => {
    if (datasets.length === 0) {
      return []
    }

    return [...datasets, ...datasets]
  }, [datasets])

  const handleShelbyClick = () => {
    if (isOpeningShelby) {
      return
    }

    setIsOpeningShelby(true)
    window.setTimeout(() => {
      window.location.assign("https://shelby.xyz/")
    }, 280)
  }

  return (
    <div className="flex min-h-[calc(100vh-13rem)] flex-col gap-5">
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <h2 className="text-center font-display text-3xl text-white md:text-4xl">
          Explore Top Datasets
        </h2>
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
        <section className="explore-marquee-mask rounded-2xl border border-white/10 bg-slate-900/40 py-5">
          <div className="explore-marquee-track">
            {loopedDatasets.map((dataset, index) => (
              <div key={`${dataset.id}-${index}`} className="explore-marquee-item">
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
                        Login to View
                      </Link>
                    )
                  }
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-auto pt-4 text-center text-lg text-slate-300 md:text-xl">
        Powered by{" "}
        <button
          type="button"
          onClick={handleShelbyClick}
          className={`shelby-link font-display text-2xl font-semibold text-pink-400 hover:text-pink-300 md:text-3xl ${
            isOpeningShelby ? "is-opening" : ""
          }`}
        >
          SHELBY
        </button>
      </footer>
    </div>
  )
}
