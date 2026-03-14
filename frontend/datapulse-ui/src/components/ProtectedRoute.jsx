import { Navigate, useLocation } from "react-router-dom"

import { useAuth } from "../context/AuthContext"

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isReady } = useAuth()
  const location = useLocation()

  if (!isReady) {
    return (
      <div className="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300">
        Checking authentication...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
