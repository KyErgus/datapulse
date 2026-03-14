import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { getMyDatasets, getMyProfile, getMyStats } from "../lib/api"
import { toDatasetCardModel } from "../lib/datasets"
import DatasetCard from "../components/DatasetCard"
import { useAuth } from "../context/AuthContext"

export default function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [datasets, setDatasets] = useState([])
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const loadProfileData = useCallback(async () => {
    setIsLoading(true)
    setError("")

    try {
      const [profileResponse, statsResponse, datasetsResponse] = await Promise.all([
        getMyProfile(),
        getMyStats(),
        getMyDatasets(),
      ])

      setProfile(profileResponse)
      setStats(statsResponse)
      setDatasets(Array.isArray(datasetsResponse) ? datasetsResponse.map(toDatasetCardModel) : [])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load profile")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProfileData()
  }, [loadProfileData])

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">My Workspace</p>
        <h2 className="font-display text-2xl text-white">
          {profile?.username || user?.username || "Profile"}
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          {profile?.profile_description || "No profile description yet."}
        </p>
        {(profile?.username || user?.username) && (
          <Link
            to={`/user/${profile?.username || user?.username}`}
            className="mt-3 inline-flex rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/20"
          >
            View Public Profile
          </Link>
        )}
      </section>

      {error && (
        <p className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      {isLoading && (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300">
          Loading profile...
        </p>
      )}

      {!isLoading && stats && (
        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">Total Datasets</p>
            <p className="mt-1 text-2xl font-semibold text-white">{stats.total_datasets}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">Total Downloads</p>
            <p className="mt-1 text-2xl font-semibold text-white">{stats.total_downloads}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">Total Revenue</p>
            <p className="mt-1 text-2xl font-semibold text-white">${stats.total_revenue}</p>
          </div>
        </section>
      )}

      {!isLoading && datasets.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-display text-xl text-white">My Datasets</h3>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {datasets.map((dataset) => (
              <DatasetCard key={dataset.id} dataset={dataset} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
