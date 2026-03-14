const trimmedBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "")

export const API_BASE_URL = trimmedBaseUrl || "/api"
export const AUTH_TOKEN_KEY = "datapulse_access_token"

function toApiUrl(path) {
  if (!path.startsWith("/")) {
    return `${API_BASE_URL}/${path}`
  }

  return `${API_BASE_URL}${path}`
}

function toQueryString(params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return
    }

    query.set(key, `${value}`)
  })

  const serialized = query.toString()
  return serialized ? `?${serialized}` : ""
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") ?? ""
  const isJson = contentType.includes("application/json")
  return isJson ? response.json() : response.text()
}

export async function apiFetch(path, options = {}) {
  const requestOptions = { ...options }
  const headers = new Headers(requestOptions.headers ?? {})
  const token = getAuthToken()

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  requestOptions.headers = headers

  const response = await fetch(toApiUrl(path), requestOptions)
  const body = await parseResponse(response)

  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? body.detail
        : response.statusText

    throw new Error(
      typeof detail === "string"
        ? detail
        : `Request failed with status ${response.status}`
    )
  }

  return body
}

export function getDownloadUrl(datasetId) {
  return toApiUrl(`/datasets/${datasetId}/download`)
}

export function getAuthToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearAuthToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
}

export async function getHealth() {
  return apiFetch("/health")
}

export async function register(payload) {
  return apiFetch("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function login(payload) {
  return apiFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function getAuthMe() {
  return apiFetch("/auth/me")
}

export async function uploadDataset({
  file,
  name,
  description,
  tags,
  datasetType,
}) {
  const formData = new FormData()
  formData.append("file", file)

  if (name) {
    formData.append("name", name)
  }
  if (description) {
    formData.append("description", description)
  }
  if (tags) {
    formData.append("tags", tags)
  }
  if (datasetType) {
    formData.append("dataset_type", datasetType)
  }

  return apiFetch("/datasets/upload", {
    method: "POST",
    body: formData,
  })
}

export async function listDatasets({ search } = {}) {
  return apiFetch(`/datasets${toQueryString({ search })}`)
}

export async function getExploreDatasets({
  search,
  tags,
  priceMin,
  priceMax,
  sort,
  limit,
} = {}) {
  return apiFetch(
    `/datasets/explore${toQueryString({
      search,
      tags,
      price_min: priceMin,
      price_max: priceMax,
      sort,
      limit,
    })}`
  )
}

export async function getMarketplaceDatasets({ sort, limit } = {}) {
  return apiFetch(`/marketplace${toQueryString({ sort, limit })}`)
}

export async function getDataset(datasetId) {
  return apiFetch(`/datasets/${datasetId}`)
}

export async function getDatasetPreview(datasetId) {
  return apiFetch(`/datasets/${datasetId}/preview`)
}

export async function getDatasetAnalytics(datasetId) {
  return apiFetch(`/datasets/${datasetId}/analytics`)
}

export async function deleteDataset(datasetId) {
  return apiFetch(`/datasets/${datasetId}`, { method: "DELETE" })
}

export async function updateDataset(datasetId, payload) {
  return apiFetch(`/datasets/${datasetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function purchaseDataset(datasetId) {
  return apiFetch(`/datasets/${datasetId}/purchase`, { method: "POST" })
}

export async function getMyDatasets() {
  return apiFetch("/me/datasets")
}

export async function getMyProfile() {
  return apiFetch("/me/profile")
}

export async function getMyStats() {
  return apiFetch("/me/stats")
}

export async function getUserProfile(username) {
  return apiFetch(`/users/${username}`)
}

export async function getPublicDataset(publicId) {
  return apiFetch(`/public/dataset/${publicId}`)
}

export async function getPublicDatasetPreview(publicId) {
  return apiFetch(`/public/dataset/${publicId}/preview`)
}

export async function getPublicDatasetAnalytics(publicId) {
  return apiFetch(`/public/dataset/${publicId}/analytics`)
}
