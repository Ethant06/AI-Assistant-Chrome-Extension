// components/ui/ThemeToggle.tsx
"use client"

import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"

/**
 * Switches between light and dark themes.
 *
 * Both icons render always — CSS decides which is visible based on the
 * "dark" class on <html>. Server and client render identical markup,
 * so there's no hydration mismatch and no need for a mounted guard.
 */
export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme()

    return (
        <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="p-2 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text transition-colors"
        >
            <Sun className="w-5 h-5 hidden dark:block" />
            <Moon className="w-5 h-5 block dark:hidden" />
        </button>
    )
}