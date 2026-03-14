import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"

import {
  getDataset,
  getDatasetAnalytics,
  getDatasetPreview,
  getDownloadUrl,
  purchaseDataset,
} from "../lib/api"
import { toDatasetCardModel } from "../lib/datasets"
import DatasetCard from "../components/DatasetCard"
import PreviewTable from "../components/PreviewTable"
import AnalyticsPanel from "../components/AnalyticsPanel"

export default function DatasetDetail() {
  const { id } = useParams()
  const [dataset, setDataset] = useState(null)
  const [preview, setPreview] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [actionMessage, setActionMessage] = useState("")

  const loadDetail = useCallback(async () => {
    if (!id) {
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const [detailResponse, previewResponse, analyticsResponse] = await Promise.all([
        getDataset(id),
        getDatasetPreview(id),
        getDatasetAnalytics(id),
      ])

      if (detailResponse?.error === "Dataset not found") {
        setDataset(null)
        setError("Dataset not found.")
      } else {
        setDataset(toDatasetCardModel(detailResponse))
        setPreview(previewResponse)
        setAnalytics(analyticsResponse)
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load dataset detail."
      )
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const handlePurchase = async () => {
    if (!id) {
      return
    }

    setActionMessage("")
    try {
      const response = await purchaseDataset(id)
      setActionMessage(response.message || "Purchase successful.")
      await loadDetail()
    } catch (requestError) {
      setActionMessage(requestError instanceof Error ? requestError.message : "Purchase failed.")
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Dataset</p>
        <h2 className="font-display text-2xl text-white">Dataset Detail</h2>
      </section>

      {isLoading && (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300">
          Loading dataset...
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      {dataset && (
        <section className="space-y-4">
          <DatasetCard
            dataset={dataset}
            actions={
              <>
                <a
                  href={getDownloadUrl(dataset.id)}
                  className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-cyan-200"
                >
                  Download
                </a>
                {dataset.raw?.is_paid && !dataset.raw?.can_download && (
                  <button
                    type="button"
                    onClick={handlePurchase}
                    className="rounded-lg bg-amber-300 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-amber-200"
                  >
                    Buy ${dataset.raw?.price}
                  </button>
                )}
                {dataset.raw?.owner_username && (
                  <Link
                    to={`/user/${dataset.raw.owner_username}`}
                    className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/20"
                  >
                    Owner: {dataset.raw.owner_username}
                  </Link>
                )}
              </>
            }
          />

          {actionMessage && (
            <p className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200">
              {actionMessage}
            </p>
          )}

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="mb-3 text-sm font-semibold text-white">Preview</p>
            <PreviewTable preview={preview} />
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="mb-3 text-sm font-semibold text-white">Analytics</p>
            <AnalyticsPanel analytics={analytics} />
          </div>
        </section>
      )}
    </div>
  )
}
