"use client"

import { useState } from "react"
import { ChatMessage } from "@/components/chat/ChatMessage"
import { ChatInput } from "@/components/chat/ChatInput"
import { ChatEmptyState } from "@/components/chat/ChatEmptyState"
import type { Message } from "@/types/api"


/**
 * Chat page for a new conversation
 *
 * Owns the message list. Messages are held in local state during the exchange - the backend
 * persists them automatically after each response completes.
 *
 * Message list flexes to fill available height and scrolls independently
 * Input is pinned to the bottom
 */
export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)


  function handleSend(question: string) {
    // optimistic user message - appears instantly, before any request.
    // negative id avoids colliding with real server-assigned ids
    const userMessage: Message = {
      id: -Date.now(),
      role: "user",
      content: question,
      created_at: new Date().toISOString(),
      sources: [],
    }
    setMessages((prev) => [...prev, userMessage])
    setSending(true)

    // TODO: CALL THE API and stream response
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
              <ChatEmptyState onSelectPrompt={handleSend} />
          ) : (
              <div className="mx-auto max-w-3xl space-y-6 p-6">
                  {messages.map((message) => (
                      <ChatMessage key={message.id} message={message} />
                  ))}
              </div>
          )}
      </div>

        <ChatInput onSend={handleSend} disabled={sending} />
    </div>
    )
}