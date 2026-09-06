"use client"

import { Suspense, useState, useRef, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { sendChatRequest, getConversation, listConversations } from "@/lib/api"
import { ChatMessage } from "@/components/chat/ChatMessage"
import { ChatInput } from "@/components/chat/ChatInput"
import { ChatEmptyState } from "@/components/chat/ChatEmptyState"
import type { Message } from "@/types/api"


/**
 * Chat page for a new conversation.
 *
 * Messages stay in local state. After the first reply we keep this page
 * mounted, remember the conversation id, and only update the URL in the
 * address bar so a refresh can reopen the thread.
 *
 * "New chat" navigates to /chat?new={timestamp}. That query always
 * changes, so this page can reset even when Next already considers
 * us to be on /chat.
 */
export default function ChatPage() {
  return (
    <Suspense>
      <NewChatSession />
    </Suspense>
  )
}

function NewChatSession() {
  const searchParams = useSearchParams()
  const newSession = searchParams.get("new")

  const [conversationId, setConversationId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!newSession) return
    setConversationId(null)
    setMessages([])
    setSending(false)
    window.history.replaceState(null, "", "/chat")
    window.dispatchEvent(new Event("conversations-changed"))
  }, [newSession])

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

    let id = savedId
    if (!id) {
        const list = await listConversations()
        id = list.conversations[0]?.id ?? null
    }

    if (id) {
        setConversationId(id)
        window.history.replaceState(null, "", `/chat/${id}`)
        window.dispatchEvent(new Event("conversations-changed"))
        const full = await getConversation(id)
        setMessages(full.messages)
    }
    } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to send message")
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