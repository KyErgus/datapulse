import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { useAuth } from "../context/AuthContext"

export default function Register() {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [profileDescription, setProfileDescription] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const navigate = useNavigate()
  const { register } = useAuth()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      await register({ username, email, password, profile_description: profileDescription })
      navigate("/", { replace: true })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Registration failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/60 p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Authentication</p>
      <h2 className="font-display text-2xl text-white">Create Account</h2>

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
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          minLength={6}
          required
        />
        <textarea
          rows={3}
          placeholder="Profile description"
          value={profileDescription}
          onChange={(event) => setProfileDescription(event.target.value)}
          className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-cyan-200 disabled:bg-slate-500"
        >
          {isSubmitting ? "Creating..." : "Create Account"}
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <p className="mt-4 text-sm text-slate-300">
        Already have an account?{" "}
        <Link to="/login" className="text-cyan-300 hover:text-cyan-200">
          Login
        </Link>
      </p>
    </div>
  )
}
