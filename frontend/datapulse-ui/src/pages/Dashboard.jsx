import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"

import {
  deleteDataset,
  getDataset,
  getDatasetAnalytics,
  getDatasetPreview,
  getDownloadUrl,
  getMyDatasets,
  updateDataset,
  uploadDataset,
} from "../lib/api"
import { isDatasetMissing, toDatasetCardModel } from "../lib/datasets"
import DatasetCard from "../components/DatasetCard"
import PreviewTable from "../components/PreviewTable"
import AnalyticsPanel from "../components/AnalyticsPanel"
import { useAuth } from "../context/AuthContext"

const initialUploadForm = {
  name: "",
  description: "",
  tags: "",
  datasetType: "",
}

export default function Dashboard() {
  const { isAuthenticated, user } = useAuth()
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
  const [listingForm, setListingForm] = useState({
    visibility: "private",
    isPaid: false,
    price: "0",
    license: "CC-BY-4.0",
  })
  const [isSavingListing, setIsSavingListing] = useState(false)
  const [listingMessage, setListingMessage] = useState("")
  const fileRef = useRef(null)

  const loadDatasets = useCallback(async () => {
    if (!isAuthenticated) {
      setDatasets([])
      setListError("")
      setIsLoadingList(false)
      return
    }

    setIsLoadingList(true)
    setListError("")

    try {
      const response = await getMyDatasets()
      const normalized = Array.isArray(response)
        ? response.map(toDatasetCardModel)
        : []
      setDatasets(normalized)
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Failed to load datasets.")
    } finally {
      setIsLoadingList(false)
    }
  }, [isAuthenticated])

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
    void loadDatasets()
  }, [loadDatasets])

  useEffect(() => {
    if (isAuthenticated) {
      return
    }

    setSelectedId(null)
    setSelectedDataset(null)
    setPreview(null)
    setAnalytics(null)
    setActionMessage("")
  }, [isAuthenticated])

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
  const filteredDatasets = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return datasets
    }

    return datasets.filter((dataset) => {
      const haystack = [
        dataset.title,
        dataset.description,
        dataset.tags.join(" "),
        dataset.raw?.filename || "",
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [datasets, search])

  const handleUpload = async (event) => {
    event.preventDefault()

    if (!isAuthenticated) {
      setUploadMessage("You need to log in before uploading a dataset.")
      return
    }

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
      await loadDatasets()
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

      await loadDatasets()
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Delete failed.")
    }
  }

  const detailDataset = selectedDataset || selectedFromList

  useEffect(() => {
    if (!detailDataset) {
      setListingMessage("")
      return
    }

    setListingForm({
      visibility: detailDataset.raw?.visibility || "private",
      isPaid: Boolean(detailDataset.raw?.is_paid),
      price: `${detailDataset.raw?.price ?? 0}`,
      license: detailDataset.raw?.license || "CC-BY-4.0",
    })
    setListingMessage("")
  }, [detailDataset])

  const handleSaveListing = async (event) => {
    event.preventDefault()
    if (!detailDataset) {
      return
    }

    setIsSavingListing(true)
    setListingMessage("")

    try {
      const parsedPrice = Number(listingForm.price)
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        throw new Error("Price must be a valid non-negative number.")
      }

      const payload = {
        visibility: listingForm.visibility,
        is_paid: listingForm.isPaid,
        price: listingForm.isPaid ? parsedPrice : 0,
        license: listingForm.license.trim() || "CC-BY-4.0",
      }

      await updateDataset(detailDataset.id, payload)
      setListingMessage(
        payload.visibility === "marketplace"
          ? "Dataset is now listed in Marketplace."
          : "Listing settings updated."
      )
      await loadDatasets()
      if (selectedId) {
        await loadInsights(selectedId)
      }
    } catch (error) {
      setListingMessage(error instanceof Error ? error.message : "Failed to update listing.")
    } finally {
      setIsSavingListing(false)
    }
  }

  const handleQuickMarketplace = async (isPaid) => {
    if (!detailDataset) {
      return
    }

    setListingForm((current) => ({
      ...current,
      visibility: "marketplace",
      isPaid,
      price: isPaid ? (Number(current.price) > 0 ? current.price : "9.99") : "0",
    }))

    try {
      await updateDataset(detailDataset.id, {
        visibility: "marketplace",
        is_paid: isPaid,
        price: isPaid ? Math.max(0, Number(listingForm.price) || 9.99) : 0,
        license: listingForm.license.trim() || "CC-BY-4.0",
      })
      setListingMessage(
        isPaid
          ? "Dataset listed as paid in Marketplace."
          : "Dataset listed as free in Marketplace."
      )
      await loadDatasets()
      if (selectedId) {
        await loadInsights(selectedId)
      }
    } catch (error) {
      setListingMessage(error instanceof Error ? error.message : "Failed to list dataset.")
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Workspace</p>
          <div className="mt-3 flex justify-center">
            <Link
              to="/login"
              className="rounded-xl bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-900 transition hover:bg-cyan-200"
            >
              Login
            </Link>
          </div>
        </section>

        <section className="h-[50vh] min-h-[280px] rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:p-6">
          <div className="data-importance-stage h-full w-full">
            <div className="data-source-core" />
            <div className="data-flow-line" />
            <div className="data-packet-lane">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <span
                  key={index}
                  className="data-packet"
                  style={{
                    "--delay": `${index * 0.65}s`,
                    "--top": `${44 + (index % 3) * 6}%`,
                  }}
                />
              ))}
            </div>
            <div className="data-insight-bars">
              {[30, 45, 62, 78, 90].map((height, index) => (
                <span
                  key={height}
                  className="data-insight-bar"
                  style={{
                    "--target-height": `${height}%`,
                    "--delay": `${index * 0.25}s`,
                  }}
                />
              ))}
            </div>
            <p className="data-importance-caption">
              Data creation transforms raw signals into decisions.
            </p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Workspace</p>
        <h2 className="font-display text-2xl text-white">Upload and Manage Datasets</h2>
        <p className="mt-1 text-sm text-slate-300">
          All backend features are connected here: upload, search, inspect, preview,
          analytics, download and delete.
        </p>
        {!isAuthenticated && (
          <p className="mt-3 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Login is required to upload and manage datasets in your workspace.{" "}
            <Link to="/login" className="font-semibold underline">
              Login
            </Link>
          </p>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="space-y-5">
          <form
            onSubmit={handleUpload}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:p-5"
          >
            <h3 className="font-display text-xl text-white">Upload</h3>
            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  id="dataset-file-input"
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  disabled={!isAuthenticated}
                  className="hidden"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={!isAuthenticated}
                    className="rounded-md bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-900 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-500"
                  >
                    Choose File
                  </button>
                  <p className="min-w-0 truncate text-xs text-slate-300">
                    {file ? file.name : "No file selected"}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  Accepted formats: CSV and JSON.
                </p>
              </div>

              <input
                type="text"
                placeholder="Display name"
                value={uploadForm.name}
                onChange={(event) =>
                  setUploadForm((current) => ({ ...current, name: event.target.value }))
                }
                disabled={!isAuthenticated}
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
                disabled={!isAuthenticated}
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
                  disabled={!isAuthenticated}
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
                  disabled={!isAuthenticated}
                  className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <button
                type="submit"
                disabled={!isAuthenticated || !file || isUploading}
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
              <h3 className="font-display text-xl text-white">
                My Datasets {user?.username ? `@${user.username}` : ""}
              </h3>
              <span className="text-xs text-slate-400">
                {isAuthenticated ? `${filteredDatasets.length} items` : "Login required"}
              </span>
            </div>

            {!isAuthenticated && (
              <p className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                My Datasets is private and visible only to the logged-in user.{" "}
                <Link to="/login" className="font-semibold underline">
                  Login
                </Link>
              </p>
            )}

            {isAuthenticated && (
              <>
                <input
                  type="text"
                  placeholder="Search in my datasets..."
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
                  {!isLoadingList && !listError && filteredDatasets.length === 0 && (
                    <p className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">
                      No datasets in your workspace.
                    </p>
                  )}
                  {filteredDatasets.map((dataset) => (
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
                        <button
                          type="button"
                          onClick={() => setSelectedId(dataset.id)}
                          className="rounded-md bg-emerald-400/25 px-2 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/35"
                        >
                          Sell
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:p-5">
            <h3 className="font-display text-xl text-white">Sell In Marketplace</h3>
            {!detailDataset && (
              <p className="mt-2 text-sm text-slate-300">
                Select one of your datasets to configure pricing and publish it.
              </p>
            )}

            {detailDataset && (
              <form onSubmit={handleSaveListing} className="mt-3 space-y-3">
                <p className="text-sm text-slate-300">
                  Selected: <span className="font-semibold text-white">{detailDataset.title}</span>
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-wide text-slate-400">Visibility</span>
                    <select
                      value={listingForm.visibility}
                      onChange={(event) =>
                        setListingForm((current) => ({
                          ...current,
                          visibility: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                    >
                      <option value="private">Private</option>
                      <option value="public">Public</option>
                      <option value="marketplace">Marketplace</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-wide text-slate-400">Pricing</span>
                    <select
                      value={listingForm.isPaid ? "paid" : "free"}
                      onChange={(event) =>
                        setListingForm((current) => ({
                          ...current,
                          isPaid: event.target.value === "paid",
                          price: event.target.value === "paid" ? current.price : "0",
                        }))
                      }
                      className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                    >
                      <option value="free">Free</option>
                      <option value="paid">Paid</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-wide text-slate-400">Price (USD)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={listingForm.price}
                      disabled={!listingForm.isPaid}
                      onChange={(event) =>
                        setListingForm((current) => ({
                          ...current,
                          price: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-wide text-slate-400">License</span>
                    <input
                      type="text"
                      value={listingForm.license}
                      onChange={(event) =>
                        setListingForm((current) => ({
                          ...current,
                          license: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={isSavingListing}
                    className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-cyan-200 disabled:bg-slate-500"
                  >
                    {isSavingListing ? "Saving..." : "Save Listing"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleQuickMarketplace(false)}
                    className="rounded-xl bg-emerald-400/25 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/35"
                  >
                    List Free
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleQuickMarketplace(true)}
                    className="rounded-xl bg-fuchsia-400/25 px-4 py-2 text-sm font-semibold text-fuchsia-100 hover:bg-fuchsia-400/35"
                  >
                    List Paid
                  </button>
                </div>

                {listingMessage && (
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200">
                    {listingMessage}
                  </p>
                )}
              </form>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:p-5">
            <h3 className="font-display text-xl text-white">Dataset Insights</h3>
            {!isAuthenticated && (
              <p className="mt-2 text-sm text-slate-300">
                Insights panel is available only for your account datasets after login.
              </p>
            )}
            {isAuthenticated && !selectedId && (
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

          {isAuthenticated && detailDataset && (
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

          {isAuthenticated && isLoadingInsights && (
            <p className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">
              Loading preview and analytics...
            </p>
          )}

          {isAuthenticated && detailDataset && !isLoadingInsights && (
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
