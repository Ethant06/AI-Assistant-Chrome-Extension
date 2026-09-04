// components/documents/DocumentActions.tsx
"use client"

import { useState } from "react"
import { MoreVertical, Pencil, ExternalLink, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { RenameDialog } from "@/components/documents/rename-dialog"
import type { Document } from "@/types/api"

interface DocumentActionsProps {
    document: Document
    onRename: (id: number, title: string) => Promise<void>
    onDelete: (id: number) => Promise<void>
}

/**
 * Per-document action menu.
 *
 * Owns the open state for its rename and delete dialogs, but not the
 * mutations themselves — those are passed in from the page, which owns
 * the document list and must update it after either action.
 */
export function DocumentActions({
    document,
    onRename,
    onDelete,
}: DocumentActionsProps) {
    const [renameOpen, setRenameOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)

    async function handleDelete() {
        setDeleting(true)
        try {
            await onDelete(document.id)
            setDeleteOpen(false)
        } catch {
            // parent surfaces the error via toast; just stop the spinner
            setDeleting(false)
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0"
                            aria-label="Document actions"
                        />
                    }
                >
                    <MoreVertical className="size-4" />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                        <Pencil className="size-4" />
                        Rename
                    </DropdownMenuItem>

                    {/* only offered when the document came from a URL */}
                    {document.source_url && (
                        <DropdownMenuItem
                            onClick={() =>
                                window.open(
                                    document.source_url!,
                                    "_blank",
                                    "noopener,noreferrer"
                                )
                            }
                        >
                            <ExternalLink className="size-4" />
                            Open source
                        </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteOpen(true)}
                    >
                        <Trash2 className="size-4" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <RenameDialog
                open={renameOpen}
                onOpenChange={setRenameOpen}
                currentTitle={document.title}
                onRename={(title) => onRename(document.id, title)}
            />

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{document.title}&rdquo; and everything indexed from
                            it will be permanently removed. Past answers that cited
                            it will no longer link back to it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {deleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}