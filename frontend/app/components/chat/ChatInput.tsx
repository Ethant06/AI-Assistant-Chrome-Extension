"use client"

import { useState } from "react"
import { ArrowUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"


interface ChatInputProps {
    onSend: (question: string) => void
    disabled?: boolean
}



/**
 * Message composer.
 *
 * Owns only the draft text — once sent, the parent takes over.
 * Enter submits, Shift+Enter inserts a newline, matching the
 * convention users expect from chat interfaces.
 */
export function ChatInput({ onSend, disabled }: ChatInputProps) {
    const [value, setValue] = useState("")

    function submit() {
        const trimmed = value.trim()
        if (!trimmed || disabled) return
        onSend(trimmed)
        setValue("")
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        // Enter sends, Shift+Enter adds a newline
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            submit()
        }
    }

  return (
    <div className="border-t bg-background p-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown} // this is for the enter key sending functionality
                placeholder="Ask a question about your documents..."
                className="max-h-40 min-h-11 resize-none wrap-break-word"
                disabled={disabled}
            />
            <Button //this button is for the click sending functionality
                size="icon"
                onClick={submit}
                disabled={disabled || !value.trim()}
                aria-label="Send message"
            >
                {disabled ? (
                    <Loader2 className="size-4 animate-spin" />
                ) : (
                    <ArrowUp className="size-4" />
                )}
            </Button>
        </div>
    </div>
  )
}