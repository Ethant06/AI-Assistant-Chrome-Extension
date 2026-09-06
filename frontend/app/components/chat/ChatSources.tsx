"use client"

import { FileText, ExternalLink } from "lucide-react"
import type { Source } from "@/types/api"

interface ChatSourcesProps {
    sources: Source[]
}

/**
 * Documents cited in an assistant answer.
 *
 * The backend deduplicates by document, so each entry here is a distinct
 * document even if several of its chunks were retrieved.
 *
 * Sources with a URL are clickable; manually pasted documents aren't,
 * since there's nowhere to link to.
 */
export function ChatSources({ sources }: ChatSourcesProps) {
    if (sources.length === 0) return null

    return (
        <div className="mt-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Sources</p>
            <div className="flex flex-wrap gap-2">
                {sources.map((source) => {
                    const content = (
                        <>
                            <FileText className="size-3 shrink-0" />
                            <span className="truncate">{source.document_title}</span>
                            {source.source_url && (
                                <ExternalLink className="size-3 shrink-0 opacity-60" />
                            )}
                        </>
                    )

                    const className = "inline-flex max-w-56 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground"

                    return source.source_url ? (
                      <a
                            key={source.document_id}
                            href={source.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${className} transition-colors hover:bg-accent hover:text-foreground`}
                        >
                            {content}
                      </a>
                    ) : (
                        <span key={source.document_id} className={className}>
                            {content}
                        </span>
                    )
                })}
            </div>
        </div>
    )
}