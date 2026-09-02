"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser, logout as apiLogout } from "@/lib/api"
import type { User } from "@/types/api"

interface AuthContextValue {
  user: User | null
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Provides the authenticated user to all dashboard pages and enforces
 * route protection.
 *
 * Because the JWT lives in an httpOnly cookie, JavaScript cannot read it
 * to determine login state. This calls GET /auth/me on mount — a 200 means
 * the cookie is valid, an error means it isn't and the user is redirected.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)


  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => {
        setUser(null)
        router.replace("/login")
      })
      .finally(() => setLoading(false))
  }, [router])


  async function logout() {
    try {
      await apiLogout()
    } catch {

    } finally {
      setUser(null)
      router.push("/login")
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}


export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }

  return context
}