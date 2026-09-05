"use client"

import { useState, useRef, useEffect } from "react"
import { toast } from "sonner"
import { sendChatRequest, getConversation } from "@/lib/api"
import { ChatMessage } from "@/components/chat/ChatMessage"
import { ChatInput } from "@/components/chat/ChatInput"
import { ChatEmptyState } from "@/components/chat/ChatEmptyState"
import type { Message } from "@/types/api"


/**
 * Chat page for a new conversation.
 *
 * Messages stay in local state. After the first reply we keep this page
 * mounted, remember the conversation id, and only update the URL in the
 * address bar so a refresh can reopen the thread. Navigating to /chat/{id}
 * would remount a different page and look like a refresh.
 */
export default function ChatPage() {
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)

  // auto-scroll target — keeps the newest message in view as tokens stream
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])


  async function handleSend(question: string) {
    // optimistic user message - appears instantly, before any request.
    // negative id avoids colliding with real server-assigned ids
    const userMessage: Message = {
      id: -Date.now(),
      role: "user",
      content: question,
      created_at: new Date().toISOString(),
      sources: [],
    }

    // empty assistant message that tokens will fill in
    const assistantMessage: Message = {
      id: -Date.now() - 1,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      sources: [],
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setSending(true)

    try {
    const savedId = await sendChatRequest(
      { question, conversation_id: conversationId },
      (token) => {
        if (!token) return
        setMessages((prev) => {
            const last = prev[prev.length - 1]
            return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + token },
            ]
        })
      }
    )

    if (savedId) {
        setConversationId(savedId)
        window.history.replaceState(null, "", `/chat/${savedId}`)
        const full = await getConversation(savedId)
        setMessages(full.messages)
    }
    } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to send message")
        // drop the empty assistant bubble so the user isn't left
        // staring at a blank message
        setMessages((prev) => prev.slice(0, -1))
    } finally {
        setSending(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
              <ChatEmptyState onSelectPrompt={handleSend} />
          ) : (
              <div className="mx-auto max-w-3xl space-y-6 p-6">
                  {messages.map((message, i) => (
                      <ChatMessage key={message.id} message={message} streaming={sending && i === messages.length - 1}/>
                  ))}
                  <div ref={bottomRef} />
              </div>
          )}
      </div>

        <ChatInput onSend={handleSend} disabled={sending} />
    </div>
  )
}