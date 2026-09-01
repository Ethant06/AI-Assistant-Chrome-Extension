"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ReactNode } from "react"


/**
 * Wraps next-themes' provider.
 *
 * Exists as a thin wrapper so the rest of the app imports from a stable
 * local path rather than the library directly — if the theme library is
 * ever swapped, only this file changes.
 *
 * attribute="class"  toggles a "dark" class on <html>, which the CSS
 *                    variables in globals.css key off
 * defaultTheme       falls back to the user's OS preference on first visit
 * enableSystem       allows a "system" option that follows OS changes live
 */

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}