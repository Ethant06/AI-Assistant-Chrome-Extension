"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { sendChatRequest, listConversations, getConversation } from "@/lib/api"
import { ChatMessage } from "@/components/chat/ChatMessage"
import { ChatInput } from "@/components/chat/ChatInput"
import { ChatEmptyState } from "@/components/chat/ChatEmptyState"
import type { Message } from "@/types/api"


/**
 * Chat page for a new conversation.
 *
 * Messages are held in local state during the exchange. The backend
 * persists them automatically once streaming completes, so after the
 * response finishes we refetch the saved conversation to pick up the
 * real message IDs and source citations, then redirect to /chat/{id}.
 *
 * Streaming means the assistant message is created empty and grows as
 * tokens arrive — the last message in state is mutated on each token.
 */
export default function ChatPage() {
  const router = useRouter()

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

    // TODO: CALL THE API and stream response
    try {
    await sendChatRequest({ question, conversation_id: null }, (token) => {
        // append each token to the last message in the list.
        // slice(0, -1) copies everything except the last item,
        // then we spread the last item with its content extended —
        // never mutating, so React detects the change.
        setMessages((prev) => {
            const last = prev[prev.length - 1]
            return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + token },
            ]
        })
    })

    // streaming done — the backend has now saved the conversation.
    // fetch the newest one to get real ids and source citations.
    const { conversations } = await listConversations()
    const newest = conversations[0]

    if (newest) {
        const full = await getConversation(newest.id)
        setMessages(full.messages)
        // replace the URL so refreshing loads this conversation.
        // replace, not push, so back doesn't return to an empty /chat
        router.replace(`/chat/${newest.id}`)
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
              </div>
          )}
      </div>

        <ChatInput onSend={handleSend} disabled={sending} />
    </div>
  )
}