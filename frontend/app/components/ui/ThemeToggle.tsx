// components/ui/ThemeToggle.tsx
"use client"

import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Switches between light and dark themes.
 *
 * Both icons render always — CSS controls which is visible based on the
 * .dark class, so server and client markup match and no mounted guard
 * is needed to avoid a hydration mismatch.
 */
export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme()

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
        >
            <Sun className="size-4 hidden dark:block" />
            <Moon className="size-4 block dark:hidden" />
        </Button>
    )
}