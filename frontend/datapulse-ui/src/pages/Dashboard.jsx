import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"

import {
  deleteDataset,
  getDataset,
  getDatasetAnalytics,
  getDatasetPreview,
  getDownloadUrl,
  listDatasets,
  uploadDataset,
} from "../lib/api"
import { isDatasetMissing, toDatasetCardModel } from "../lib/datasets"
import DatasetCard from "../components/DatasetCard"
import PreviewTable from "../components/PreviewTable"
import AnalyticsPanel from "../components/AnalyticsPanel"

const initialUploadForm = {
  name: "",
  description: "",
  tags: "",
  datasetType: "",
}

export default function Dashboard() {
  const [datasets, setDatasets] = useState([])
  const [search, setSearch] = useState("")
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [listError, setListError] = useState("")

  const [selectedId, setSelectedId] = useState(null)
  const [selectedDataset, setSelectedDataset] = useState(null)
  const [preview, setPreview] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)

  const [uploadForm, setUploadForm] = useState(initialUploadForm)
  const [file, setFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState("")
  const [actionMessage, setActionMessage] = useState("")
  const fileRef = useRef(null)

  const loadDatasets = useCallback(async (searchValue) => {
    setIsLoadingList(true)
    setListError("")

    try {
      const response = await listDatasets({ search: searchValue })
      const normalized = Array.isArray(response)
        ? response.map(toDatasetCardModel)
        : []
      setDatasets(normalized)
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Failed to load datasets.")
    } finally {
      setIsLoadingList(false)
    }
  }, [])

  const loadInsights = useCallback(async (datasetId) => {
    if (!datasetId) {
      return
    }

    setIsLoadingInsights(true)
    setActionMessage("")

    try {
      const [detailResponse, previewResponse, analyticsResponse] =
        await Promise.all([
          getDataset(datasetId),
          getDatasetPreview(datasetId),
          getDatasetAnalytics(datasetId),
        ])

      if (isDatasetMissing(detailResponse)) {
        setSelectedDataset(null)
        setPreview(null)
        setAnalytics(null)
        setActionMessage("Selected dataset no longer exists.")
        return
      }

      setSelectedDataset(toDatasetCardModel(detailResponse))
      setPreview(previewResponse)
      setAnalytics(analyticsResponse)
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Failed to load dataset insights."
      )
    } finally {
      setIsLoadingInsights(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadDatasets(search.trim())
    }, 250)

    return () => {
      clearTimeout(timeout)
    }
  }, [search, loadDatasets])

  useEffect(() => {
    if (!selectedId) {
      return
    }

    void loadInsights(selectedId)
  }, [selectedId, loadInsights])

  const selectedFromList = useMemo(
    () => datasets.find((dataset) => dataset.id === selectedId) ?? null,
    [datasets, selectedId]
  )

  const handleUpload = async (event) => {
    event.preventDefault()

    if (!file) {
      setUploadMessage("Please select a file first.")
      return
    }

    setIsUploading(true)
    setUploadMessage("")

    try {
      await uploadDataset({
        file,
        name: uploadForm.name,
        description: uploadForm.description,
        tags: uploadForm.tags,
        datasetType: uploadForm.datasetType,
      })

      setUploadForm(initialUploadForm)
      setFile(null)
      if (fileRef.current) {
        fileRef.current.value = ""
      }

      setUploadMessage("Dataset uploaded successfully.")
      await loadDatasets(search.trim())
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Upload failed.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (dataset) => {
    const confirmed = window.confirm(
      `Delete "${dataset.title}"? This will remove the file from storage.`
    )

    if (!confirmed) {
      return
    }

    try {
      await deleteDataset(dataset.id)
      setActionMessage("Dataset deleted.")

      if (selectedId === dataset.id) {
        setSelectedId(null)
        setSelectedDataset(null)
        setPreview(null)
        setAnalytics(null)
      }

      await loadDatasets(search.trim())
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Delete failed.")
    }
  }

  const detailDataset = selectedDataset || selectedFromList

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Workspace</p>
        <h2 className="font-display text-2xl text-white">Upload and Manage Datasets</h2>
        <p className="mt-1 text-sm text-slate-300">
          All backend features are connected here: upload, search, inspect, preview,
          analytics, download and delete.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="space-y-5">
          <form
            onSubmit={handleUpload}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:p-5"
          >
            <h3 className="font-display text-xl text-white">Upload</h3>
            <div className="mt-4 space-y-3">
              <input
                ref={fileRef}
                type="file"
                required
                accept=".csv,.json,text/csv,application/json"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-300 file:px-2 file:py-1 file:text-xs file:font-bold file:text-slate-900"
              />

              <input
                type="text"
                placeholder="Display name"
                value={uploadForm.name}
                onChange={(event) =>
                  setUploadForm((current) => ({ ...current, name: event.target.value }))
                }
                className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />

              <textarea
                rows={3}
                placeholder="Description"
                value={uploadForm.description}
                onChange={(event) =>
                  setUploadForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  type="text"
                  placeholder="Tags (comma separated)"
                  value={uploadForm.tags}
                  onChange={(event) =>
                    setUploadForm((current) => ({ ...current, tags: event.target.value }))
                  }
                  className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                />
                <input
                  type="text"
                  placeholder="Dataset type"
                  value={uploadForm.datasetType}
                  onChange={(event) =>
                    setUploadForm((current) => ({
                      ...current,
                      datasetType: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <button
                type="submit"
                disabled={!file || isUploading}
                className="w-full rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                {isUploading ? "Uploading..." : "Upload Dataset"}
              </button>
            </div>

            {uploadMessage && (
              <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200">
                {uploadMessage}
              </p>
            )}
          </form>

          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-display text-xl text-white">My Datasets</h3>
              <span className="text-xs text-slate-400">{datasets.length} items</span>
            </div>

            <input
              type="text"
              placeholder="Search by filename..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="mb-4 w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />

            <div className="space-y-3">
              {isLoadingList && (
                <p className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">
                  Loading datasets...
                </p>
              )}
              {listError && (
                <p className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {listError}
                </p>
              )}
              {!isLoadingList && !listError && datasets.length === 0 && (
                <p className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">
                  No datasets found.
                </p>
              )}
              {datasets.map((dataset) => (
                <div
                  key={dataset.id}
                  className={`rounded-xl border p-3 ${
                    selectedId === dataset.id
                      ? "border-cyan-300/70 bg-cyan-500/10"
                      : "border-white/10 bg-slate-950/60"
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{dataset.title}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {dataset.sizeLabel} • {dataset.createdAtLabel}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(dataset.id)}
                      className="rounded-md bg-cyan-300 px-2 py-1 text-xs font-bold text-slate-900"
                    >
                      Open
                    </button>
                    <a
                      href={getDownloadUrl(dataset.id)}
                      className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-slate-100 hover:bg-white/15"
                    >
                      Download
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleDelete(dataset)}
                      className="rounded-md bg-rose-400/30 px-2 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-400/40"
                    >
                      Delete
                    </button>
                    <Link
                      to={`/dataset/${dataset.id}`}
                      className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-slate-100 hover:bg-white/20"
                    >
                      Detail
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:p-5">
            <h3 className="font-display text-xl text-white">Dataset Insights</h3>
            {!selectedId && (
              <p className="mt-2 text-sm text-slate-300">
                Select a dataset from the left panel to view details, preview and analytics.
              </p>
            )}
            {actionMessage && (
              <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200">
                {actionMessage}
              </p>
            )}
          </div>

          {detailDataset && (
            <DatasetCard
              dataset={detailDataset}
              compact
              actions={
                <>
                  <a
                    href={getDownloadUrl(detailDataset.id)}
                    className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/20"
                  >
                    Download
                  </a>
                  {detailDataset.publicId && (
                    <span className="rounded-lg bg-emerald-400/20 px-3 py-2 text-xs font-semibold text-emerald-100">
                      public: {detailDataset.publicId}
                    </span>
                  )}
                </>
              }
            />
          )}

          {isLoadingInsights && (
            <p className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">
              Loading preview and analytics...
            </p>
          )}

          {detailDataset && !isLoadingInsights && (
            <>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="mb-3 text-sm font-semibold text-white">Preview</p>
                <PreviewTable preview={preview} />
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="mb-3 text-sm font-semibold text-white">Analytics</p>
                <AnalyticsPanel analytics={analytics} />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
