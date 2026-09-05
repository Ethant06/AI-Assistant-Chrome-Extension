"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getConversation, sendChatRequest } from "@/lib/api"
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
export default function ConversationPage() {
  const params = useParams()
  const conversationId = Number(params.id)

  const [messages, setMessages] = useState<Message[]>([])
  const [title, setTitle] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getConversation(conversationId)
        .then((conv) => {
            setMessages(conv.messages)
            setTitle(conv.title)
        })
        .catch((err) =>
            toast.error(
                err instanceof Error ? err.message : "Failed to load conversation"
            )
        )
        .finally(() => setLoading(false))
  }, [conversationId])



  useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function handleSend(question: string) {
    const userMessage: Message = {
        id: -Date.now(),
        role: "user",
        content: question,
        created_at: new Date().toISOString(),
        sources: [],
    }
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
      await sendChatRequest(
        { question, conversation_id: conversationId },
        (token) => {
            setMessages((prev) => {
                const last = prev[prev.length - 1]
                return [
                    ...prev.slice(0, -1),
                    { ...last, content: last.content + token },
                ]
            })
        }
      )

        // refetch to pick up real ids and source citations
        const conv = await getConversation(conversationId)
        setMessages(conv.messages)
    } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to send message")
        setMessages((prev) => prev.slice(0, -1))
    } finally {
        setSending(false)
    }
  }

  if (loading) {
      return (
          <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
      )
  }

  return (
      <div className="flex h-full flex-col">
          {title && (
              <header className="shrink-0 border-b px-6 py-3">
                  <h1 className="truncate text-sm font-medium">{title}</h1>
              </header>
          )}

          <div className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl space-y-6 p-6">
                  {messages.map((message, i) => (
                      <ChatMessage
                          key={message.id}
                          message={message}
                          streaming={sending && i === messages.length - 1}
                      />
                  ))}
                  <div ref={bottomRef} />
              </div>
          </div>

          <ChatInput onSend={handleSend} disabled={sending} />
      </div>
  )
}