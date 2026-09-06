"use client"

import { Bot} from "lucide-react"
import type { Message } from "@/types/api"

import { ChatSources } from "@/components/chat/ChatSources"

interface ChatMessageProps {
  message: Message
  streaming?: boolean
}


/**
 * A single message in a conversation
 *
 *
 * User messages align right, assistant messages align left with an avatar,
 */
export function ChatMessage({ message, streaming }: ChatMessageProps) {
  const isUser = message.role === "user"


  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <Bot className="size-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
               {/* blinking block shows the response is still generating */}
               {streaming && (
                    <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-foreground align-text-bottom" />
                )}
          </p>
          {/* sources render here once we build ChatSources */}
          {/* sources only exist after the message is saved, so they appear
        once streaming finishes and the conversation is refetched */}
          {!streaming && <ChatSources sources={message.sources} />}
      </div>
    </div>
  )
}