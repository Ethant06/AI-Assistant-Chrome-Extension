"use client"

import { Loader2 } from "lucide-react"
import { AuthProvider, useAuth } from "@/components/providers/AuthProvider"


/**
 * Layout for all authenticated pages.
 *
 * Every page under (dashboard) renders inside this, so wrapping it in AuthProvider
 * protects all of them without per-page guards.
 */
export default function DashboardLayout({children}: {children: React.ReactNode}) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  )
}

/**
 * Inner component — separate so it can call useAuth, which requires
 * being inside the provider.
 */
function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

    // verifying the session — show a spinner rather than flashing
    // either the dashboard or the login page
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) return null

  return <div className="min-h-screen">{children}</div>
}