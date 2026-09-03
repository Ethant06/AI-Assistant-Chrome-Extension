"use client"

import { Loader2 } from "lucide-react"
import { AuthProvider, useAuth } from "@/components/providers/AuthProvider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/SideBar"
import { NavBar } from "@/components/layout/NavBar"

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

  return (
      <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
              <NavBar />
              <main className="flex-1 overflow-y-auto">{children}</main>
          </SidebarInset>
      </SidebarProvider>
  )
}