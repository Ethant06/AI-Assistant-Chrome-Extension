/**
 * Displays one saved document.
 *
 * Purely presentational — holds no state and performs no API calls.
 * The rename and delete callbacks pass straight through to
 * DocumentActions without being invoked here.
 *
 * Handles two nullable fields from the API:
 *   source_url  null when content was pasted rather than saved from a URL
 *   excerpt     null if the document has no content
 */

"use client"
import { DocumentActions } from "@/components/documents/DocumentActions"
import { Card, CardContent } from "../ui/card"
import type { Document } from "@/types/api"

// this is for TypeScript type-checking. Defines the shape of the props DocumentCard
// expects. The component receives a prop called document and that document must match Document type
interface DocumentCardProps {
  document: Document
  onRename: (id: number, title: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

{
  /**
   * This function component derives the attributes per document
   * and fills in generic cards with the attribute information such as date
   * created, source link, document tite.
   *
   * The card also contains a menu option for moving to a folder, renaming title,
   * copy source link, and to delete
   */
}
export function DocumentCard({ document, onRename, onDelete }: DocumentCardProps) {
  const createdAt = new Date(document.created_at).toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
    }
  )

  return (
    <Card className="group flex h-full min-w-0 cursor-pointer flex-col overflow-hidden transition-colors hover:bg-accent/50">
      <CardContent className="flex min-h-52 min-w-0 flex-1 flex-col p-5">

        {/* Title + menu */}

        {/*This div container positions document Title and Menu at the ceiling with title on the left and menu on the right corner of the card */}
        <div className="flex min-w-0 items-start justify-between gap-3">
          <h3 className="min-w-0 truncate font-serif text-lg leading-tight">
            {document.title}
          </h3>
          <div className="shrink-0">
            <DocumentActions
              document={document}
              onRename={onRename}
              onDelete={onDelete}
            />
          </div>
        </div>


        {/*This serves a short description / excerpt for the document */}
        <p className="mt-3 min-h-20 overflow-hidden text-sm leading-relaxed break-words text-muted-foreground line-clamp-4">
          {document.excerpt}
        </p>

        {/*Divider */}
        <div className="mt-auto my-4 border-t"></div>

        {/*Bottom metadata such as source URL and date created*/}
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">
              {document.source_url ? formatUrl(document.source_url) : "Manual"}
            </span>

            <span className="shrink-0">·</span>

            <span className="shrink-0">
              {createdAt}
            </span>
          </div>
        </div>

      </CardContent>
    </Card>
  )


}
/**
 * Extracts the hostname for compact display.
 * new URL() throws on malformed input, so fall back to the raw string.
 */
function formatUrl(url: string): string {
    try {
        return new URL(url).hostname
    } catch {
        return url
    }
}