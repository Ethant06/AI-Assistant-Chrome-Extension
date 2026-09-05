// components/chat/ChatEmptyState.tsx
"use client"

import { Button } from "@/components/ui/button"

interface ChatEmptyStateProps {
    onSelectPrompt: (prompt: string) => void
}

const suggestions = [
    "Summarize what I've saved recently",
    "What are the key points from my documents?",
]

/**
 * Shown before the first message in a new conversation.
 *
 * Suggested prompts give users a starting point — an empty text box
 * with no guidance is a common reason people abandon chat interfaces.
 */
export function ChatEmptyState({ onSelectPrompt }: ChatEmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        </div>

        <h2 className="mt-4 text-lg font-medium">
            Ask anything about your documents
        </h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Answers are grounded in what you&apos;ve saved — with sources.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
            {suggestions.map((prompt) => (
                <Button
                    key={prompt}
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectPrompt(prompt)}
                >
                    {prompt}
                </Button>
            ))}
        </div>
    </div>
  )
}