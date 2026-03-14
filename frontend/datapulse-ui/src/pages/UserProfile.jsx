import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"

import { getUserProfile } from "../lib/api"
import { toDatasetCardModel } from "../lib/datasets"
import DatasetCard from "../components/DatasetCard"

export default function UserProfile() {
  const { username } = useParams()
  const [profile, setProfile] = useState(null)
  const [datasets, setDatasets] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const loadProfile = useCallback(async () => {
    if (!username) {
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const response = await getUserProfile(username)
      setProfile(response)
      setDatasets(Array.isArray(response.datasets) ? response.datasets.map(toDatasetCardModel) : [])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load user profile.")
    } finally {
      setIsLoading(false)
    }
  }, [username])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Public Profile</p>
        <h2 className="font-display text-2xl text-white">{profile?.username || username}</h2>
        <p className="mt-1 text-sm text-slate-300">
          {profile?.profile_description || "No profile description."}
        </p>
        {profile && (
          <p className="mt-2 text-sm text-slate-200">
            Total downloads: {profile.total_downloads}
          </p>
        )}
      </section>

      {isLoading && (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300">
          Loading profile...
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      {!isLoading && !error && datasets.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {datasets.map((dataset) => (
            <DatasetCard
              key={dataset.id}
              dataset={dataset}
              actions={
                <Link
                  to={`/dataset/${dataset.id}`}
                  className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-cyan-200"
                >
                  View Dataset
                </Link>
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
