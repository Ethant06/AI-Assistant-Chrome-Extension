"use client"

import { useEffect, useState } from "react"
import { FileText, Plus, CircleAlert } from "lucide-react"
import { deleteDocument, listDocuments, updateDocument } from "@/lib/api"
import { DocumentCard } from "@/components/documents/DocumentCard"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { Document } from "@/types/api"
import { AddDocumentDialog } from "@/components/documents/DocumentDialog"

/**
 * Documents page — lists everything the user has saved to their knowledge base.
 *
 * Owns the document list state. Cards are presentational, so any action
 * that mutates the list (delete, rename) is handled here and passed down.
 *
 * Handles four render states rather than only the success case:
 *
 *  if (loading) return <grid of skeletons>
    if (error) return <error message>
    if (documents.length === 0) return <empty state>
    return <grid of cards>
 */

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // This will control the add-document dialog once it exists
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    listDocuments()
    .then((res) => setDocuments(res.documents))
    .catch((err) => setError(err instanceof Error ? err.message: "Failed to load documents"))
    .finally(() => setLoading(false))
  }, [])

  async function handleRename(id: number, title: string) {
    const updated = await updateDocument(id, { title })
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, ...updated } : doc))
    )
  }

  async function handleDelete(id: number) {
    await deleteDocument(id)
    setDocuments((prev) => prev.filter((doc) => doc.id !== id))
  }


  return (
    <div className="mx-auto max-w-5xl p-8">
        <header className="mb-8 flex items-center justify-between gap-5">
            <div>
                <h1 className="text-2xl font-semibold">Library</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    {loading
                        ? "Loading..."
                        : `${documents.length} ${
                              documents.length === 1 ? "document" : "documents"
                          }`}
                </p>
            </div>

            <Button onClick={() => setDialogOpen(true)}>
                <Plus className="size-4" />
                Add Document
            </Button>
        </header>

        <DocumentsBody
            documents={documents}
            loading={loading}
            error={error}
            onAddClick={() => setDialogOpen(true)}
            onRename={handleRename}
            onDelete={handleDelete}
        />

        <AddDocumentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          // prepend so the newest document appears first,
          // matching the API's created_at descending order
          onCreated={(doc) => setDocuments((prev) => [doc, ...prev])}
        />
    </div>
  )


  /**
 * Renders whichever of the four states applies.
 *
 * Extracted from the page so the header renders identically regardless
 * of loading or error state — otherwise early returns in the page would
 * hide the header while loading.
 */
function DocumentsBody({ documents, loading, error, onAddClick, onRename, onDelete,
}: {
    documents: Document[]
    loading: boolean
    error: string | null
    onAddClick: () => void
    onRename: (id: number, title: string) => Promise<void>
    onDelete: (id: number) => Promise<void>
}) {
    if (loading) {
      return (
          <div className="grid gap-4 sm:grid-cols-2">
              {/* fixed height roughly matching a real card so the layout
                  doesn't jump when data arrives */}
              {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
          </div>
      )
    }

    if (error) {
      return (
          <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 py-16 text-center">
              <CircleAlert className="size-8 text-destructive" />
              <p className="mt-3 font-medium">Couldn&apos;t load your documents</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => window.location.reload()}
              >
                  Try again
              </Button>
          </div>
      )
    }

    if (documents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
                <FileText className="size-8 text-muted-foreground" />
                <p className="mt-3 font-medium">No documents yet</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Save an article or paste some text to start building your
                    knowledge base.
                </p>
                <Button className="mt-4" onClick={onAddClick}>
                    <Plus className="size-4" />
                    Add your first document
                </Button>
            </div>
        )
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            {documents.map((document) => (
                <DocumentCard
                    key={document.id}
                    document={document}
                    onRename={onRename}
                    onDelete={onDelete}
                />
            ))}
        </div>
    )
}





}