import { useState } from "react"

import {
  getPublicDataset,
  getPublicDatasetAnalytics,
  getPublicDatasetPreview,
  API_BASE_URL,
} from "../lib/api"
import PreviewTable from "../components/PreviewTable"
import AnalyticsPanel from "../components/AnalyticsPanel"

function toDownloadUrl(downloadPath) {
  if (!downloadPath) {
    return ""
  }

  if (downloadPath.startsWith("http://") || downloadPath.startsWith("https://")) {
    return downloadPath
  }

  const normalized = downloadPath.startsWith("/") ? downloadPath : `/${downloadPath}`
  return `${API_BASE_URL}${normalized}`
}

export default function PublicTools() {
  const [publicId, setPublicId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const [dataset, setDataset] = useState(null)
  const [preview, setPreview] = useState(null)
  const [analytics, setAnalytics] = useState(null)

  const handleLookup = async (event) => {
    event.preventDefault()
    const trimmedId = publicId.trim()

    if (!trimmedId) {
      setError("Enter a public dataset ID.")
      return
    }

    setError("")
    setIsLoading(true)

    try {
      const [datasetResponse, previewResponse, analyticsResponse] = await Promise.all([
        getPublicDataset(trimmedId),
        getPublicDatasetPreview(trimmedId),
        getPublicDatasetAnalytics(trimmedId),
      ])

      if (datasetResponse?.error === "Dataset not found") {
        setError("Dataset not found for this public ID.")
        setDataset(null)
        setPreview(null)
        setAnalytics(null)
      } else {
        setDataset(datasetResponse)
        setPreview(previewResponse)
        setAnalytics(analyticsResponse)
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load public dataset."
      )
      setDataset(null)
      setPreview(null)
      setAnalytics(null)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Public Access</p>
        <h2 className="font-display text-2xl text-white">Public Dataset Tools</h2>
        <p className="mt-1 text-sm text-slate-300">
          Query <code>/public/dataset/{`{public_id}`}</code>, preview and analytics endpoints
          in one flow.
        </p>
      </section>

      <form
        onSubmit={handleLookup}
        className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:grid-cols-[1fr_auto]"
      >
        <input
          type="text"
          value={publicId}
          onChange={(event) => setPublicId(event.target.value)}
          placeholder="Enter public_id..."
          className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-cyan-200 disabled:bg-slate-500"
        >
          {isLoading ? "Loading..." : "Lookup"}
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      {dataset && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <h3 className="font-display text-xl text-white">{dataset.name || dataset.filename}</h3>
          <p className="mt-1 text-sm text-slate-300">Version: {dataset.version ?? 1}</p>
          {dataset.download_url && (
            <a
              href={toDownloadUrl(dataset.download_url)}
              className="mt-3 inline-flex rounded-lg bg-cyan-300 px-3 py-2 text-sm font-bold text-slate-900 hover:bg-cyan-200"
            >
              Download Public Dataset
            </a>
          )}
        </section>
      )}

      {preview && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="mb-3 text-sm font-semibold text-white">Public Preview</p>
          <PreviewTable preview={preview} />
        </section>
      )}

      {analytics && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="mb-3 text-sm font-semibold text-white">Public Analytics</p>
          <AnalyticsPanel analytics={analytics} />
        </section>
      )}
    </div>
  )
}
