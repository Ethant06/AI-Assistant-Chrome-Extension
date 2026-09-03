// components/layout/AppSidebar.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Brain, FileText, MessageSquare, Settings } from "lucide-react"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarTrigger,
} from "@/components/ui/sidebar"

/**
 * Persistent navigation sidebar for authenticated pages.
 *
 * Nav links are defined as data rather than JSX so adding a route is a
 * one-line change. The "Recent" group is populated with conversations
 * once the chat feature is built.
 *
 * collapsible="icon" shrinks the sidebar to an icon rail; labels hide
 * via the group-data-[collapsible=icon] variant and tooltips take over.
 */

type NavItem = {
    title: string
    url: string
    icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
    { title: "Documents", url: "/documents", icon: FileText },
    { title: "Chat", url: "/chat", icon: MessageSquare },
]

/**
 * Renders a list of nav links with active-state highlighting.
 * Extracted so the footer and any future groups can reuse it.
 */
function SidebarNavItems({
    items,
    isActivePath,
}: {
    items: NavItem[]
    isActivePath: (href: string) => boolean
}) {
    return (
        <>
            {items.map((item) => {
                const active = isActivePath(item.url)
                return (
                    <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                            isActive={active}
                            tooltip={item.title}
                            render={
                                <Link
                                    href={item.url}
                                    aria-current={active ? "page" : undefined}
                                />
                            }
                        >
                            <item.icon />
                            <span className="group-data-[collapsible=icon]:hidden">
                                {item.title}
                            </span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                )
            })}
        </>
    )
}

export function AppSidebar() {
    const pathname = usePathname()

    /**
     * True when the pathname matches the href exactly, or is nested under it.
     *
     * Using startsWith alone would incorrectly match sibling routes —
     * /chats would highlight /chat. Requiring a trailing slash for the
     * prefix case avoids that while still matching /chat/4.
     */
    const isActivePath = (href: string) =>
        pathname === href || pathname.startsWith(`${href}/`)

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <div className="flex items-center justify-between gap-2 px-1 py-1.5 group-data-[collapsible=icon]:justify-center">
                    <div className="flex items-center gap-2 px-1 group-data-[collapsible=icon]:hidden">
                        <Brain className="size-5 shrink-0 text-primary" />
                        <span className="font-semibold whitespace-nowrap">
                            Knowledge Base
                        </span>
                    </div>
                    <SidebarTrigger />
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarNavItems
                                items={navItems}
                                isActivePath={isActivePath}
                            />
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                    <SidebarGroupLabel>Recent</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {/* conversations render here once chat is built */}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarNavItems
                        items={[
                            { title: "Settings", url: "/settings", icon: Settings },
                        ]}
                        isActivePath={isActivePath}
                    />
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}