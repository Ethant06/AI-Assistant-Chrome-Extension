"use client"

import { useTheme } from "next-themes"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bell, Monitor, Moon, Settings, Sun, User, LogOut } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/components/providers/AuthProvider"

/**
 * Top bar with the user menu.
 *
 * Groups account info, theme selection, and sign out into a single
 * dropdown rather than scattering controls across the bar.
 */
export function NavBar() {
    const { user, logout } = useAuth()
    const { theme, setTheme } = useTheme()

    // keeps the menu open when switching themes so the user can
    // compare options without reopening it each time
    const keepDropdownOpen = (e: { preventDefault: () => void }) => e.preventDefault()

    // "test@test.com" → "TE"
    const initials = user?.email.slice(0, 2).toUpperCase() ?? "?"

    return (
        <nav className="h-14 shrink-0 border-b bg-card px-4 flex items-center justify-end">
            <div className="flex items-center gap-4">
                <Bell className="size-5 text-muted-foreground" />

                <DropdownMenu>
                    <DropdownMenuTrigger render={<Avatar className="cursor-pointer size-8" />}>
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </DropdownMenuTrigger>

                    <DropdownMenuContent sideOffset={10} align="end" className="w-56">
                        <DropdownMenuGroup>
                            <DropdownMenuLabel className="font-normal">
                                <p className="text-sm font-medium">My Account</p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {user?.email}
                                </p>
                            </DropdownMenuLabel>

                            <DropdownMenuItem>
                                <User className="size-4" /> Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Settings className="size-4" /> Settings
                            </DropdownMenuItem>
                        </DropdownMenuGroup>

                        <DropdownMenuSeparator />

                        <DropdownMenuGroup>
                            <DropdownMenuLabel>Theme</DropdownMenuLabel>
                            <DropdownMenuRadioGroup
                                value={theme ?? "system"}
                                onValueChange={(value) =>
                                    // cast needed because the radio group returns a
                                    // plain string, but setTheme expects our union type
                                    setTheme(value as "dark" | "light" | "system")
                                }
                            >
                                <DropdownMenuRadioItem
                                    value="light"
                                    onSelect={keepDropdownOpen}
                                >
                                    <Sun className="size-4" /> Light
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem
                                    value="dark"
                                    onSelect={keepDropdownOpen}
                                >
                                    <Moon className="size-4" /> Dark
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem
                                    value="system"
                                    onSelect={keepDropdownOpen}
                                >
                                    <Monitor className="size-4" /> System
                                </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuGroup>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem variant="destructive" onClick={logout}>
                            <LogOut className="size-4" /> Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </nav>
    )
}