"use client"

import { useState, type SyntheticEvent } from "react"
import { Loader2 } from "lucide-react"
import { createDocument } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import type { Document } from "@/types/api"

/**
 * This interface defines what AddDocumentDialogProps component expects from its parent component.
 */
interface AddDocumentDialogProps {
  //This tells dialog if it is visible or not. Parent should have setDialogOpen(True or False) and we derive from that
  open: boolean

  //this can tell parent to change the Open state. If user clicks cancel or closes the catalog, the parent receives that and does setDialogOpen(False)
  onOpenChange: (open: boolean) => void

  // When we open the dialog and create a new document upload, the dialog sends document to backend.
  // Now dialog calls onCreated(newDocument object) then parent can update its list setDocuments() of documents and the UI changes then.
  // My New Notes       ← just added
  // Document A
  //  Document B
  //  Document C
  //we do not refetch the list of documents again since it makes another HTTP request. Rather we create a document, API returns new document, and parent adds it to existing list.
  onCreated: (document: Document) => void
}


/**
 * On success, the dialog receives the fully ingested document and passes it
 * to the parent so it can be added to the document list.
 *
 * Ingestion/processing is handled while the dialog is submitting, so the
 * document only appears in the list once it is ready to use.
 */
export function AddDocumentDialog({ open, onOpenChange, onCreated } : AddDocumentDialogProps) {
  const [title, setTitle] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  function resetForm() {
    setTitle("")
    setSourceUrl("")
    setContent("")
    setError(null)
  }

  function handleClose() {
    resetForm()
    onOpenChange(false)
  }

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError("Title is required")
      return
    }

    if (content.trim().length < 50) {
        setError("Content must be at least 50 characters to be useful")
        return
    }

    setSubmitting(true)

    try {
      const document = await createDocument({
        title: title.trim(),
        raw_content: content.trim(),
        source_url: sourceUrl.trim() || null,
      })

      onCreated(document)
      resetForm()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save document")
    } finally {
      setSubmitting(false)
    }
  }




  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
          <DialogHeader>
              <DialogTitle>Add to knowledge base</DialogTitle>
              <DialogDescription>
                  Paste content you want to be able to ask questions about.
              </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Introduction to PostgreSQL Indexes"
                      disabled={submitting}
                      autoFocus
                  />
              </div>

              <div className="space-y-2">
                  <Label htmlFor="sourceUrl">
                      Source URL{" "}
                      <span className="text-muted-foreground font-normal">
                          (optional)
                      </span>
                  </Label>
                  <Input
                      id="sourceUrl"
                      type="url"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      placeholder="https://postgresql.org/docs/indexes"
                      disabled={submitting}
                  />
              </div>

              <div className="space-y-2 ">
                  <div className="flex items-center justify-between">
                      <Label htmlFor="content">Content</Label>
                      <span className="text-xs text-muted-foreground">
                          {wordCount.toLocaleString()} words
                      </span>
                  </div>
                  <Textarea
                      id="content"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Paste the full text here..."
                      className="min-h-48 max-h-64 resize-none overflow-y-auto"
                      disabled={submitting}
                  />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <DialogFooter>
                  <Button
                      type="button"
                      variant="outline"
                      onClick={handleClose}
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