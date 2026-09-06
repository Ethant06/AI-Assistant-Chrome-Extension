// components/layout/ConversationList.tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageSquare } from "lucide-react"
import { listConversations } from "@/lib/api"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import type { ConversationSummary } from "@/types/api"

/**
 * Recent conversations in the sidebar.
 *
 * Refetches when the route changes and whenever a chat is saved or
 * "New chat" is clicked (conversations-changed).
 */
export function ConversationList() {
    const pathname = usePathname()
    const [conversations, setConversations] = useState<ConversationSummary[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        function refresh() {
            listConversations()
                .then((res) => setConversations(res.conversations))
                .catch(() => setConversations([]))
                .finally(() => setLoading(false))
        }

        refresh()
        window.addEventListener("conversations-changed", refresh)
        return () => window.removeEventListener("conversations-changed", refresh)
    }, [pathname])

    if (loading) {
        return (
            <SidebarMenu>
                {Array.from({ length: 3 }).map((_, i) => (
                    <SidebarMenuItem key={i}>
                        <Skeleton className="h-8 w-full" />
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        )
    }

    if (conversations.length === 0) {
        return (
            <p className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                No conversations yet
            </p>
        )
    }

    return (
        <SidebarMenu>
            {conversations.map((conversation) => {
                const href = `/chat/${conversation.id}`
                const active = pathname === href

                return (
                    <SidebarMenuItem key={conversation.id}>
                        <SidebarMenuButton
                            isActive={active}
                            tooltip={conversation.title ?? "Untitled"}
                            render={
                                <Link
                                    href={href}
                                    aria-current={active ? "page" : undefined}
                                />
                            }
                        >
                            <MessageSquare />
                            <span className="truncate group-data-[collapsible=icon]:hidden">
                                {conversation.title ?? "Untitled"}
                            </span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                )
            })}
        </SidebarMenu>
    )
}