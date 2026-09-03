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
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-base leading-tight">{document.title}</h3>
          <button type="button" className="shrink-0 text-muted-foreground hover:text-foreground">
            <EllipsisVertical className="size-4"></EllipsisVertical>
          </button>
        </div>





      </CardContent>




    </Card>
  )








}