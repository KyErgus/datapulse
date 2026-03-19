/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react"

import {
  clearAuthToken,
  getAuthMe,
  getAuthToken,
  login as loginRequest,
  register as registerRequest,
  setAuthToken,
  walletLogin as walletLoginRequest,
} from "../lib/api"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isReady, setIsReady] = useState(() => !getAuthToken())

  useEffect(() => {
    let mounted = true
    const token = getAuthToken()

    if (!token) {
      return () => {
        mounted = false
      }
    }

    getAuthMe()
      .then((me) => {
        if (mounted) {
          setUser(me)
        }
      })
      .catch(() => {
        clearAuthToken()
        if (mounted) {
          setUser(null)
        }
      })
      .finally(() => {
        if (mounted) {
          setIsReady(true)
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isReady,
      async login(credentials) {
        const response = await loginRequest(credentials)
        setAuthToken(response.access_token)
        setUser(response.user)
        return response.user
      },
      async loginWithWallet(payload) {
        const response = await walletLoginRequest(payload)
        setAuthToken(response.access_token)
        setUser(response.user)
        return response.user
      },
      async register(payload) {
        const response = await registerRequest(payload)
        setAuthToken(response.access_token)
        setUser(response.user)
        return response.user
      },
      logout() {
        clearAuthToken()
        setUser(null)
      },
      async refreshMe() {
        const me = await getAuthMe()
        setUser(me)
        return me
      },
    }),
    [user, isReady]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider")
  }
  return value
}
