"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getConversation, sendChatMessage } from "@/lib/api"
import { ChatMessage } from "@/components/chat/ChatMessage"
import { ChatInput } from "@/components/chat/ChatInput"
import type { Message } from "@/types/api"

/**
 * An existing conversation.
 *
 * Loads the full message history on mount, then behaves like the new-chat
 * page except that follow-up questions include the conversation_id so the
 * backend appends to this thread rather than starting a new one.
 */