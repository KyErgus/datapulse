import { useMemo, useState } from "react"

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

function buildPublicEndpointPath(publicId, endpointKey) {
  if (endpointKey === "preview") {
    return `/public/dataset/${publicId}/preview`
  }
  if (endpointKey === "analytics") {
    return `/public/dataset/${publicId}/analytics`
  }
  return `/public/dataset/${publicId}`
}

function toApiRequestUrl(path) {
  if (API_BASE_URL.startsWith("http://") || API_BASE_URL.startsWith("https://")) {
    return `${API_BASE_URL}${path}`
  }
  return `${API_BASE_URL}${path}`
}

function MiniBarChart({ title, items, valueFormatter = (value) => `${value}` }) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
        <p className="mb-2 text-xs uppercase tracking-widest text-slate-400">{title}</p>
        <p className="text-sm text-slate-400">No data available.</p>
      </div>
    )
  }

  const maxValue = Math.max(...items.map((item) => item.value), 1)

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
      <p className="mb-3 text-xs uppercase tracking-widest text-slate-400">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
              <span className="truncate">{item.label}</span>
              <span className="font-semibold text-white">{valueFormatter(item.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-300"
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PublicTools() {
  const [publicId, setPublicId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const [dataset, setDataset] = useState(null)
  const [preview, setPreview] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [playgroundEndpoint, setPlaygroundEndpoint] = useState("dataset")
  const [playgroundResult, setPlaygroundResult] = useState(null)
  const [isRunningPlayground, setIsRunningPlayground] = useState(false)
  const [playgroundError, setPlaygroundError] = useState("")

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
        setPlaygroundResult(null)
        setPlaygroundError("")
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
      setPlaygroundResult(null)
      setPlaygroundError("")
    } finally {
      setIsLoading(false)
    }
  }

  const schemaRows = useMemo(() => {
    if (!preview || !Array.isArray(preview.columns) || preview.columns.length === 0) {
      return []
    }

    const totalRows = Number(analytics?.rows ?? 0)
    const previewRows = Array.isArray(preview.preview) ? preview.preview : []
    const types = analytics?.column_types ?? {}
    const missingValues = analytics?.missing_values ?? {}

    return preview.columns.map((columnName) => {
      const missingCount = Number(missingValues[columnName] ?? 0)
      const uniqueSamples = []

      previewRows.forEach((row) => {
        const value = row?.[columnName]
        if (value === null || value === undefined || `${value}`.trim() === "") {
          return
        }
        const textValue = `${value}`
        if (!uniqueSamples.includes(textValue) && uniqueSamples.length < 3) {
          uniqueSamples.push(textValue)
        }
      })

      return {
        name: columnName,
        type: types[columnName] || "unknown",
        missingCount,
        missingPct: totalRows > 0 ? (missingCount / totalRows) * 100 : 0,
        samples: uniqueSamples,
      }
    })
  }, [preview, analytics])

  const missingChartData = useMemo(() => {
    return [...schemaRows]
      .sort((a, b) => b.missingCount - a.missingCount)
      .slice(0, 8)
      .map((column) => ({ label: column.name, value: column.missingCount }))
  }, [schemaRows])

  const numericMeanChartData = useMemo(() => {
    if (!analytics || typeof analytics.numeric_stats !== "object") {
      return []
    }

    const entries = Object.entries(analytics.numeric_stats)
      .map(([columnName, stats]) => {
        const meanValue = Number(stats?.mean)
        if (Number.isNaN(meanValue)) {
          return null
        }
        return {
          label: columnName,
          value: Math.abs(meanValue),
        }
      })
      .filter(Boolean)

    return entries.sort((a, b) => b.value - a.value).slice(0, 8)
  }, [analytics])

  const runPlayground = async () => {
    const trimmedId = publicId.trim()
    if (!trimmedId) {
      setPlaygroundError("Enter a public dataset ID first.")
      return
    }

    const path = buildPublicEndpointPath(trimmedId, playgroundEndpoint)
    const requestUrl = toApiRequestUrl(path)
    setIsRunningPlayground(true)
    setPlaygroundError("")

    try {
      const response = await fetch(requestUrl)
      const contentType = response.headers.get("content-type") ?? ""
      const body = contentType.includes("application/json")
        ? await response.json()
        : await response.text()

      setPlaygroundResult({
        path,
        status: response.status,
        ok: response.ok,
        body,
      })
    } catch (requestError) {
      setPlaygroundError(
        requestError instanceof Error ? requestError.message : "Failed to run request."
      )
      setPlaygroundResult(null)
    } finally {
      setIsRunningPlayground(false)
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

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <p className="mb-3 text-sm font-semibold text-white">Public API Playground</p>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <select
            value={playgroundEndpoint}
            onChange={(event) => setPlaygroundEndpoint(event.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          >
            <option value="dataset">GET /public/dataset/{`{public_id}`}</option>
            <option value="preview">GET /public/dataset/{`{public_id}`}/preview</option>
            <option value="analytics">GET /public/dataset/{`{public_id}`}/analytics</option>
          </select>
          <button
            type="button"
            onClick={runPlayground}
            disabled={isRunningPlayground}
            className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-cyan-200 disabled:bg-slate-500"
          >
            {isRunningPlayground ? "Running..." : "Run Request"}
          </button>
          {playgroundResult && (
            <span
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                playgroundResult.ok
                  ? "bg-emerald-400/20 text-emerald-100"
                  : "bg-rose-500/20 text-rose-100"
              }`}
            >
              HTTP {playgroundResult.status}
            </span>
          )}
        </div>

        {playgroundError && (
          <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {playgroundError}
          </p>
        )}

        {playgroundResult && (
          <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/60 p-3">
            <p className="text-xs uppercase tracking-widest text-slate-400">Request</p>
            <p className="mt-1 text-xs text-slate-200">
              <code>{playgroundResult.path}</code>
            </p>
            <p className="mt-3 text-xs uppercase tracking-widest text-slate-400">Response</p>
            <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-slate-100">
              {JSON.stringify(playgroundResult.body, null, 2)}
            </pre>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <p className="mb-3 text-sm font-semibold text-white">Schema Explorer</p>
        {schemaRows.length === 0 ? (
          <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300">
            Lookup a dataset first to inspect schema.
          </p>
        ) : (
          <div className="overflow-auto rounded-xl border border-white/10 bg-slate-950/60">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-800/80 text-xs uppercase tracking-wider text-slate-300">
                <tr>
                  <th className="px-3 py-2 font-semibold">Column</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Missing</th>
                  <th className="px-3 py-2 font-semibold">Missing %</th>
                  <th className="px-3 py-2 font-semibold">Sample Values</th>
                </tr>
              </thead>
              <tbody>
                {schemaRows.map((column) => (
                  <tr key={column.name} className="border-t border-white/5">
                    <td className="px-3 py-2 text-slate-100">{column.name}</td>
                    <td className="px-3 py-2 text-slate-200">{column.type}</td>
                    <td className="px-3 py-2 text-slate-200">{column.missingCount}</td>
                    <td className="px-3 py-2 text-slate-200">{column.missingPct.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-slate-300">
                      {column.samples.length > 0 ? column.samples.join(" | ") : "No sample"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <p className="mb-3 text-sm font-semibold text-white">Public Charts</p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <MiniBarChart title="Top Missing Values by Column" items={missingChartData} />
          <MiniBarChart
            title="Top Numeric Means (absolute)"
            items={numericMeanChartData}
            valueFormatter={(value) => value.toFixed(2)}
          />
        </div>
      </section>
    </div>
  )
}
