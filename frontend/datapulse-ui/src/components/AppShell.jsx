import { NavLink, Outlet } from "react-router-dom"
import { useEffect, useState } from "react"

import { getHealth } from "../lib/api"
import { useAuth } from "../context/AuthContext"

const links = [
  { to: "/", label: "Workspace" },
  { to: "/explore", label: "Explore" },
  { to: "/marketplace", label: "Marketplace" },
  { to: "/public", label: "Public Tools" },
  { to: "/profile", label: "My Profile" },
]

export default function AppShell() {
  const [backendState, setBackendState] = useState("checking")
  const { isAuthenticated, user, logout } = useAuth()

  useEffect(() => {
    let active = true

    const checkHealth = async () => {
      try {
        await getHealth()
        if (active) {
          setBackendState("online")
        }
      } catch {
        if (active) {
          setBackendState("offline")
        }
      }
    }

    void checkHealth()
    const timer = setInterval(() => {
      void checkHealth()
    }, 15000)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  return (
    <div className="app-bg min-h-screen text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 pb-6 pt-4 md:px-6">
        <header className="glass-card mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
              Data Platform
            </p>
            <h1 className="font-display text-2xl font-semibold text-white">
              DataPulse Control Center
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300">Backend</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                backendState === "online"
                  ? "bg-emerald-400/20 text-emerald-200"
                  : backendState === "offline"
                    ? "bg-rose-400/20 text-rose-200"
                    : "bg-slate-500/20 text-slate-200"
              }`}
            >
              {backendState}
            </span>
            {isAuthenticated ? (
              <button
                type="button"
                onClick={logout}
                className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-white/20"
              >
                {user?.username} • Logout
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <NavLink
                  to="/login"
                  className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-white/20"
                >
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  className="rounded-lg bg-cyan-300 px-3 py-1 text-xs font-bold text-slate-900 hover:bg-cyan-200"
                >
                  Register
                </NavLink>
              </div>
            )}
          </div>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="glass-card rounded-2xl p-4 lg:p-5">
            <nav className="flex flex-wrap gap-2 lg:flex-col">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  className={({ isActive }) =>
                    `rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-cyan-300 text-slate-900"
                        : "bg-white/5 text-slate-200 hover:bg-white/10"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </aside>

          <main className="glass-card rounded-2xl p-4 md:p-6 lg:p-7">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
