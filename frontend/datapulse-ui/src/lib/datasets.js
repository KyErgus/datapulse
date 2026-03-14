export function normalizeTags(rawTags) {
  if (Array.isArray(rawTags)) {
    return rawTags.map((tag) => `${tag}`.trim()).filter(Boolean)
  }

  if (typeof rawTags === "string") {
    return rawTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  }

  return []
}

export function formatBytes(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Unknown"
  }

  if (value < 1024) {
    return `${value} B`
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
  }

  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatDateTime(value) {
  if (!value) {
    return "Unknown"
  }

  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return `${value}`
  }

  return new Date(parsed).toLocaleString()
}

export function formatNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0"
  }

  return value.toLocaleString()
}

export function toDatasetCardModel(rawDataset) {
  const title =
    rawDataset.name ||
    rawDataset.title ||
    rawDataset.original_filename ||
    rawDataset.filename ||
    `Dataset ${rawDataset.id}`

  const sizeValue =
    rawDataset.size ??
    rawDataset.size_bytes ??
    (typeof rawDataset.file_size === "number" ? rawDataset.file_size : null)

  const createdAt =
    rawDataset.created_at || rawDataset.uploaded_at || rawDataset.updated_at

  const tags = normalizeTags(rawDataset.tags)

  return {
    id: rawDataset.id,
    publicId: rawDataset.public_id || null,
    title,
    filename: rawDataset.filename || rawDataset.original_filename || title,
    description: rawDataset.description || "No description yet.",
    tags,
    datasetType: rawDataset.dataset_type || "general",
    size: sizeValue,
    sizeLabel: formatBytes(sizeValue),
    createdAt,
    createdAtLabel: formatDateTime(createdAt),
    downloadCount: rawDataset.download_count ?? rawDataset.downloads ?? 0,
    owner: rawDataset.owner_username || rawDataset.owner || "DataPulse",
    raw: rawDataset,
  }
}

export function isDatasetMissing(datasetResponse) {
  return (
    datasetResponse &&
    typeof datasetResponse === "object" &&
    "error" in datasetResponse &&
    datasetResponse.error === "Dataset not found"
  )
}
