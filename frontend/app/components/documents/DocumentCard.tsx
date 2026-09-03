"use client"

import { EllipsisVertical } from "lucide-react"
import { Card, CardContent } from "../ui/card"
import type { Document } from "@/types/api"

// this is for TypeScript type-checking. Defines the shape of the props DocumentCard
// expects. The component receives a prop called document and that document must match Document type
interface DocumentCardProps {
  document: Document
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
export function DocumentCard({ document }: DocumentCardProps) {
  const createdAt = new Date(document.created_at).toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
    }
  )

  return (
    <Card className='group cursor-pointer transition-colors hover:bg-accent/50'>
      <CardContent className="p-4">

        {/* Title + menu */}

        {/*This div container positions document Title and Menu at the ceiling with title on the left and menu on the right corner of the card */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-base leading-tight">
            {document.title}
          </h3>
          <button type="button" className="shrink-0 text-muted-foreground hover:text-foreground">
            <EllipsisVertical className="size-4"></EllipsisVertical>
          </button>
        </div>


        {/*This serves a short description / excerpt for the document */}
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground line-clamp-3">
          {document.excerpt}
        </p>

        {/*Divider */}
        <div className="my-4 border-t"></div>

        {/*Bottom metadata such as source URL and date created*/}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">
              {document.source_url ? formatUrl(document.source_url) : "Manual"}
            </span>

            <span>·</span>

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