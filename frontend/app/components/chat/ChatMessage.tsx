"use client"

import { Bot, User } from "lucide-react"
import type { Message } from "@/types/api"

interface ChatMessageProps {
  message: Message
}


/**
 * A single message in a conversation
 *
 *
 * User messages align right, assistant messages align left with an avatar,
 */