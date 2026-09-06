// components/documents/rename-dialog.tsx
/**
 * Modal for editing a document's title.
 *
 * Deliberately generic: it takes a current title and an async callback,
 * and has no knowledge of documents, IDs, or the API. DocumentActions
 * binds the document ID before passing the callback in.
 *
 * Controlled by the parent via open/onOpenChange. The useEffect resyncs
 * the input to currentTitle whenever the dialog opens — without it,
 * abandoning a rename and reopening would show the discarded edit.
 *
 * onRename returns a Promise so this dialog can keep its spinner running,
 * catch failures, and only close on success.
 */
"use client"

import { useEffect, useState, type SyntheticEvent } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface RenameDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    currentTitle: string
    /**
     * Performs the rename. Throws on failure so the dialog can display
     * the error and stay open rather than closing on a failed request.
     */
    onRename: (title: string) => Promise<void>
}

/**
 * Modal for editing a document's title.
 *
 * Only the title can be changed — updating content or source URL would
 * invalidate the document's existing embeddings, so the backend rejects it.
 */
export function RenameDialog({
    open,
    onOpenChange,
    currentTitle,
    onRename,
}: RenameDialogProps) {
    const [title, setTitle] = useState(currentTitle)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    /**
     * Reset the input each time the dialog opens.
     *
     * Without this, abandoning a rename and reopening would show the
     * discarded edit instead of the document's actual current title.
     */
    useEffect(() => {
        if (open) {
            setTitle(currentTitle)
            setError(null)
        }
    }, [open, currentTitle])

    async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
        e.preventDefault()
        setError(null)

        const trimmed = title.trim()

        if (!trimmed) {
            setError("Title cannot be empty")
            return
        }
        // nothing changed — just close without an unnecessary request
        if (trimmed === currentTitle) {
            onOpenChange(false)
            return
        }

        setSubmitting(true)

        try {
            await onRename(trimmed)
            onOpenChange(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to rename")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Rename document</DialogTitle>
                    <DialogDescription>
                        Only the title changes — the saved content stays the same.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="rename-title">Title</Label>
                        <Input
                            id="rename-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={submitting}
                            autoFocus
                        />
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting && <Loader2 className="size-4 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
