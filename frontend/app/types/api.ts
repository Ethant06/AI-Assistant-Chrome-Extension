/**
 * TypeScript interfaces mirroring the backend's Pydantic schemas.
 *
 * These types are the frontend's contract with the API - every field here
 * corresponds exaclty to what the backend returns, including nullability.
 */


// ---Auth-----------------------------------

/**
 * Returned by POST /auth/register and GET /auth/me
 * hashed_password is never returned by the API
 */
export interface User {
    id: number
    email: string
}

/**
 * Generic success message from endpoints that return no data.
 * Used by POST /auth/login and POST /auth/logout — the JWT
 * lives in an httpOnly cookie, not in the response body.
 */
export interface MessageResponse {
    message: string
}

// ---Documents----------

/**
 * Document lifecycle status.
 * - processing: ingestion pipeline running, not yet searchable
 * - ready: fully ingested, available for RAG queries
 * - failed: ingestion failed, delete and re-upload to retry
 */
export type DocumentStatus = "processing" | "ready" | "failed"


/**
 * Returned by POST/GET/PATCH /documents/ endpoints.
 * raw_content is intentionally excluded by the backend — it can be
 * thousands of words and is never needed for display.
 */
export interface Document {
    id: number
    title: string
    source_url: string | null      // null when content was manually pasted
    status: DocumentStatus
    word_count: number | null
    chunk_count: number | null     // null until ingestion completes
    created_at: string             // ISO 8601, e.g. "2026-08-29T16:28:18.968689"
}


/**
 * Request body for POST /documents/
 */
export interface DocumentCreateRequest {
    title: string
    raw_content: string
    source_url?: string | null     // optional — null if manually pasted
}

/**
 * Request body for PATCH /documents/{id}
 * Only the title can be updated — changing content would invalidate embeddings.
 */
export interface DocumentUpdateRequest {
    title: string
}

/**
 * Returned by GET /documents/
 * total reflects the count across all pages, not just this page.
 */
export interface DocumentListResponse {
    documents: Document[]
    total: number
    page: number
    page_size: number
}


// ─── Chat ───────────────────────────────────────────

/**
 * One cited document shown below an assistant message.
 * Deduplicated by the backend — one entry per unique document,
 * even if multiple chunks from that document were used.
 */
export interface Source {
    document_id: number            // use to link to the document page
    document_title: string         // display as the citation label
    source_url: string | null      // make clickable if not null
}


/**
 * One message in a conversation.
 * User messages always have sources: []
 * Assistant messages have sources populated with cited documents.
 */
export interface Message {
    id: number
    role: "user" | "assistant"
    content: string
    created_at: string
    sources: Source[]
}


/**
 * Full conversation returned by GET /chat/conversations/{id}
 * Messages are ordered by id ascending — user message before assistant response.
 */
export interface Conversation {
    id: number
    title: string | null           // set to the first question, truncated to 100 chars
    created_at: string
    messages: Message[]
}


/**
 * Lightweight conversation for the sidebar list.
 * Returned inside ConversationListResponse — no messages included.
 */
export interface ConversationSummary {
    id: number
    title: string | null
    created_at: string
}

/**
 * Returned by GET /chat/conversations/
 * Ordered by created_at descending (newest first).
 */
export interface ConversationListResponse {
    conversations: ConversationSummary[]
    total: number
}

/**
 * Request body for POST /chat/
 * conversation_id null or omitted starts a new conversation.
 */
export interface ChatRequest {
    question: string
    conversation_id?: number | null
}


// ─── Errors ─────────────────────────────────────────

/**
 * FastAPI's standard error response shape.
 * The api.ts handleResponse function extracts detail and throws it
 * as an Error message, so components see err.message directly.
 */
export interface ApiError {
    detail: string
}