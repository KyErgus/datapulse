import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { useAuth } from "../context/AuthContext"
import {
  APTOS_WALLETS,
  connectAptosProvider,
  getInstalledAptosWallets,
  resolveWalletProvider,
} from "../lib/aptosWallets"

export default function Login() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isWalletSubmitting, setIsWalletSubmitting] = useState(false)
  const [showWalletPicker, setShowWalletPicker] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  const { login, loginWithWallet } = useAuth()

  const redirectTo = location.state?.from?.pathname || "/"

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      await login({ username, password })
      navigate(redirectTo, { replace: true })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Login failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleWalletLogin = async (walletId) => {
    setError("")
    setIsWalletSubmitting(true)

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
        throw new Error("Could not read Aptos wallet address.")
      }

      await loginWithWallet({ provider: walletId, address })
      navigate(redirectTo, { replace: true })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Wallet login failed")
    } finally {
      setIsWalletSubmitting(false)
    }
  }

  const installedWallets = getInstalledAptosWallets()

  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/60 p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Authentication</p>
      <h2 className="font-display text-2xl text-white">Login</h2>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          required
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-cyan-200 disabled:bg-slate-500"
        >
          {isSubmitting ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <div className="my-4 h-px bg-white/10" />
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Or continue with Aptos wallet</p>
      <div className="mt-3 space-y-3">
        <button
          type="button"
          onClick={() => setShowWalletPicker((current) => !current)}
          disabled={isWalletSubmitting}
          className="w-full rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-cyan-200 disabled:bg-slate-500"
        >
          {isWalletSubmitting ? "Connecting..." : "Connect Wallet"}
        </button>

        {showWalletPicker && (
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
            {installedWallets.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {installedWallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    type="button"
                    onClick={() => void handleWalletLogin(wallet.id)}
                    disabled={isWalletSubmitting}
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

      {error && (
        <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <p className="mt-4 text-sm text-slate-300">
        No account?{" "}
        <Link to="/register" className="text-cyan-300 hover:text-cyan-200">
          Register
        </Link>
      </p>
    </div>
  )
}
