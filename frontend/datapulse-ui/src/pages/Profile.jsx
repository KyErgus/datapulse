import { useCallback, useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"

import {
  connectAptosWallet,
  disconnectAptosWallet,
  disconnectXAccount,
  getMyDatasets,
  getMyProfile,
  getMyStats,
  startXOAuth,
  updateMyProfile,
} from "../lib/api"
import {
  APTOS_WALLETS,
  connectAptosProvider,
  getInstalledAptosWallets,
  resolveWalletProvider,
  shortWalletAddress,
} from "../lib/aptosWallets"
import { toDatasetCardModel } from "../lib/datasets"
import DatasetCard from "../components/DatasetCard"
import { useAuth } from "../context/AuthContext"

export default function Profile() {
  const { user, refreshMe } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [datasets, setDatasets] = useState([])
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingX, setIsSavingX] = useState(false)
  const [isSavingWallet, setIsSavingWallet] = useState(false)
  const [showWalletPicker, setShowWalletPicker] = useState(false)

  const [profileForm, setProfileForm] = useState({
    full_name: "",
    profile_description: "",
    avatar_url: "",
    location: "",
    website: "",
  })
  const profileAvatarUrl = profile?.x_avatar_url || profile?.avatar_url || ""

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
      setProfileForm({
        full_name: profileResponse.full_name || "",
        profile_description: profileResponse.profile_description || "",
        avatar_url: profileResponse.avatar_url || "",
        location: profileResponse.location || "",
        website: profileResponse.website || "",
      })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load profile")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProfileData()
  }, [loadProfileData])

  useEffect(() => {
    const xStatus = searchParams.get("x")
    if (!xStatus) {
      return
    }

    const reason = searchParams.get("reason")
    const xUsername = searchParams.get("x_username")
    if (xStatus === "connected") {
      setMessage(
        xUsername ? `X account connected: @${xUsername}` : "X account connected."
      )
      void refreshMe()
      void loadProfileData()
    } else if (xStatus === "error") {
      const readableReason = (reason || "Unknown OAuth error")
        .replaceAll("_", " ")
        .trim()
      setError(`X OAuth failed: ${readableReason}`)
    }

    const next = new URLSearchParams(searchParams)
    next.delete("x")
    next.delete("reason")
    next.delete("x_username")
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, refreshMe, loadProfileData])

  const handleProfileSave = async (event) => {
    event.preventDefault()
    setError("")
    setMessage("")
    setIsSavingProfile(true)

    try {
      const updated = await updateMyProfile(profileForm)
      setProfile(updated)
      setMessage("Profile updated.")
      await refreshMe()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update profile")
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleXOAuthConnect = async () => {
    setError("")
    setMessage("")
    setIsSavingX(true)

    try {
      const response = await startXOAuth()
      const authorizationUrl = response?.authorization_url
      if (!authorizationUrl) {
        throw new Error("Backend did not return an authorization_url")
      }
      window.location.assign(authorizationUrl)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to start X OAuth flow"
      )
      setIsSavingX(false)
    }
  }

  const handleXDisconnect = async () => {
    setError("")
    setMessage("")
    setIsSavingX(true)

    try {
      const response = await disconnectXAccount()
      const updatedUser = response.user
      setProfile(updatedUser)
      setMessage("X account disconnected.")
      await refreshMe()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to disconnect X account")
    } finally {
      setIsSavingX(false)
    }
  }

  const handleConnectWallet = async (walletId) => {
    setError("")
    setMessage("")
    setIsSavingWallet(true)

    try {
      const provider = resolveWalletProvider(walletId)
      const walletLabel = APTOS_WALLETS.find((wallet) => wallet.id === walletId)?.name || walletId
      if (!provider) {
        throw new Error(`${walletLabel} wallet not detected. Install extension and refresh.`)
      }

      const address = (
        await connectAptosProvider(provider, { allowLegacy: walletId !== "petra" })
      ).toLowerCase()
      if (!address) {
        throw new Error("Could not read Aptos address from wallet provider.")
      }

      const updated = await connectAptosWallet({
        provider: walletId,
        address,
      })
      setProfile(updated)
      setMessage(`Aptos wallet connected: ${shortWalletAddress(address)}`)
      await refreshMe()
      setShowWalletPicker(false)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to connect wallet")
    } finally {
      setIsSavingWallet(false)
    }
  }

  const handleDisconnectWallet = async () => {
    setError("")
    setMessage("")
    setIsSavingWallet(true)

    try {
      const response = await disconnectAptosWallet()
      setProfile(response.user)
      setMessage("Aptos wallet disconnected.")
      await refreshMe()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to disconnect wallet")
    } finally {
      setIsSavingWallet(false)
    }
  }
  const installedWallets = getInstalledAptosWallets()

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">My Workspace</p>
        <h2 className="font-display text-2xl text-white">
          {profile?.username || user?.username || "Profile"}
        </h2>
        {profileAvatarUrl && (
          <img
            src={profileAvatarUrl}
            alt="Profile avatar"
            className="mt-3 h-20 w-20 rounded-full border border-white/20 object-cover"
          />
        )}
        {profile?.full_name && <p className="mt-2 text-sm text-slate-200">{profile.full_name}</p>}
        <p className="mt-1 text-sm text-slate-300">
          {profile?.profile_description || "No profile description yet."}
        </p>
        {profile?.x_username && (
          <p className="mt-2 text-sm text-cyan-200">
            Connected X: @{profile.x_username}
            {profile?.x_profile_url && (
              <>
                {" "}
                <a
                  href={profile.x_profile_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  profile
                </a>
              </>
            )}
          </p>
        )}
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
      {message && (
        <p className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </p>
      )}

      {isLoading && (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300">
          Loading profile...
        </p>
      )}

      {!isLoading && (
        <section className="grid gap-4 lg:grid-cols-2">
          <form
            onSubmit={handleProfileSave}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"
          >
            <h3 className="font-display text-xl text-white">Personal Info</h3>
            <div className="mt-3 space-y-3">
              <input
                type="text"
                placeholder="Full name"
                value={profileForm.full_name}
                onChange={(event) =>
                  setProfileForm((current) => ({ ...current, full_name: event.target.value }))
                }
                className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
              />
              <input
                type="url"
                placeholder="Profile photo URL"
                value={profileForm.avatar_url}
                onChange={(event) =>
                  setProfileForm((current) => ({ ...current, avatar_url: event.target.value }))
                }
                className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
              />
              <input
                type="text"
                placeholder="Location"
                value={profileForm.location}
                onChange={(event) =>
                  setProfileForm((current) => ({ ...current, location: event.target.value }))
                }
                className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
              />
              <input
                type="url"
                placeholder="Website"
                value={profileForm.website}
                onChange={(event) =>
                  setProfileForm((current) => ({ ...current, website: event.target.value }))
                }
                className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
              />
              <textarea
                rows={3}
                placeholder="Profile description"
                value={profileForm.profile_description}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    profile_description: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
              />
              <button
                type="submit"
                disabled={isSavingProfile}
                className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-cyan-200 disabled:bg-slate-500"
              >
                {isSavingProfile ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </form>

          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <h3 className="font-display text-xl text-white">Connect X Account</h3>
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-3">
                <p className="text-xs uppercase tracking-wide text-cyan-200">
                  Recommended
                </p>
                <p className="mt-1 text-sm text-cyan-100">
                  Use secure X OAuth flow.
                </p>
                <p className="mt-3">
                  <button
                    type="button"
                    onClick={() => void handleXOAuthConnect()}
                    disabled={isSavingX}
                    className="text-sm font-semibold text-cyan-100 underline underline-offset-4 hover:text-cyan-50 disabled:text-slate-400"
                  >
                    {isSavingX ? "Redirecting..." : "Connect with X OAuth"}
                  </button>
                </p>
              </div>
              {profile?.x_username && (
                <button
                  type="button"
                  onClick={() => void handleXDisconnect()}
                  disabled={isSavingX}
                  className="rounded-xl bg-rose-400/30 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-400/40 disabled:bg-slate-500"
                >
                  Disconnect
                </button>
              )}
            </div>
          </section>
        </section>
      )}

      {!isLoading && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <h3 className="font-display text-xl text-white">Connect Aptos Wallet</h3>
          <p className="mt-2 text-sm text-slate-300">
            Connect Aptos-compatible wallets like Petra to use Web3 features.
          </p>

          {profile?.aptos_wallet_address && (
            <div className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              Connected:{" "}
              <span className="font-semibold">
                {(profile.aptos_wallet_provider || "aptos").toUpperCase()}
              </span>{" "}
              {shortWalletAddress(profile.aptos_wallet_address)}
            </div>
          )}

          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={() => setShowWalletPicker((current) => !current)}
              disabled={isSavingWallet}
              className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-cyan-200 disabled:bg-slate-500"
            >
              {isSavingWallet ? "Connecting..." : "Connect Wallet"}
            </button>

            {showWalletPicker && (
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                {installedWallets.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {installedWallets.map((wallet) => (
                      <button
                        key={wallet.id}
                        type="button"
                        onClick={() => void handleConnectWallet(wallet.id)}
                        disabled={isSavingWallet}
                        className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/20 disabled:bg-slate-700"
                      >
                        {wallet.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-300">
                      No Aptos wallet extension detected in this browser.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {APTOS_WALLETS.map((wallet) => (
                        <a
                          key={wallet.id}
                          href={wallet.installUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/20"
                        >
                          Install {wallet.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {profile?.aptos_wallet_address && (
            <button
              type="button"
              onClick={() => void handleDisconnectWallet()}
              disabled={isSavingWallet}
              className="mt-4 rounded-xl bg-rose-400/30 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-400/40 disabled:bg-slate-500"
            >
              Disconnect Wallet
            </button>
          )}
        </section>
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
