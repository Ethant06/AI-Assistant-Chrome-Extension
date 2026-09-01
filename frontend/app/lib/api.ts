/**
 * API client - every backend call lives here.
 *
 * Components never write raw fetch calls. They import funtions from this file, which handles
 * credentials, error parsing, and typing consistently.
 *
 * Authentication: the backend sets an httpOnly cookie on login. Every request includes credentials: "include" so the browser
 * sends that cookie automatically containing the JWT token. No token handling or attaching happens client-side
 * - JavaScript cannot read the cookie
 */
import type {
    User,
    Document,
    DocumentListResponse,
    DocumentCreateRequest,
    DocumentUpdateRequest,
    Conversation,
    ConversationListResponse,
    ChatRequest,
    MessageResponse,
} from "@/types/api"

const API_URL = process.env.NEXT_PUBLIC_API_URL


/**
 * Helper function for this file ONLY
 * Standard headers for requests with a JSON body.
 * jsonHeaders creates a json object and HeadersInit is TS for HTTP headers
 */
const jsonHeaders: HeadersInit = {
    "Content-Type": "application/json",
}


/**
 * This is just a HELPER FUNCTION FOR THIS FILE ONLY for the APIs
 * Unwraps a fetch response, throwing on error with the API's detail message.
 *
 * FastAPI returns errors as { "detail": "message" }, so we extract that
 * for display in the UI. 204 responses have no body to parse.
 */
async function handleResponse<T>(res: Response): Promise<T> {

  // Did the backend return an error?
    if (!res.ok) {

       // Try to get FastAPI's error message, res is possibly a json object with detail = ... attribute
       // catch is a fallback
        const error = await res.json().catch(() => ({ detail: "Request failed" }))
        throw new Error(error.detail || `HTTP ${res.status}`)
    }
    // was it successful but with no data?
    if (res.status === 204) {
        return undefined as T
    }

    // otherwise get the successful JSON data
    return res.json()
}

// ─── Auth ───────────────────────────────────────────

/**
 * Creates a new user account.
 * Does NOT log the user in — call login() afterward.
 */
export async function register(email: string, password: string): Promise<User> {
    const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ email, password }),
    })
    return handleResponse<User>(res)
}

/**
 * Logs in. The backend sets an httpOnly cookie containing the JWT - no JWT
 * token is returned or stored client-side, the browser does the job.
 *
 * credentials: "include" is required for the browser to accept the cookie.
 */

export async function login(email: string, password: string): Promise<MessageResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify({
      username: email,
      password,
    }),
  })

  return handleResponse<MessageResponse>(res)
}

/**
 * Logs out by asking the server to clear the auth cookie.
 *
 * Requires a server call because httpOnly cookies cannot be deleted
 * from JavaScript — only the server can send the Set-Cookie header
 * that expires it.
 */
export async function logout(): Promise<MessageResponse> {
    const res = await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
    })
    return handleResponse<MessageResponse>(res)
}


/**
 * Returns the current authenticated user
 *
 * Because the auth cokie is httponly and invisible to JavaScript, this is the only way to check
 * whether a valid session exists.
 * A 401 (thrown as an error) means the user needs to log in
 */
export async function getCurrentUser(): Promise<User> {
  const res = await fetch(`${API_URL}/auth/me`,{
    credentials: "include",
  })
  return handleResponse<User>(res)
}


// ─── Documents ──────────────────────────────────────

/**
 * Saves a new document and triggers ingestion on the backend.
 *
 * Returns immediately with status="processing" - poll getDocument()
 * until status becomes "ready" before the document can be used in chat.
 */
export async function createDocument(data: DocumentCreateRequest): Promise<Document> {
  const res = await fetch(`${API_URL}/documents/`, {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify(data),
  })
  return handleResponse<Document>(res)
}



/**
 * Returns a paginated list of the user's documents, newest first
 */
export async function listDocuments(page: number = 1, pageSize: number = 10): Promise<DocumentListResponse> {
  const res = await fetch(`${API_URL}/documents/?page=${page}&page_size=${pageSize}`,{
    credentials: "include"
  })

  return handleResponse<DocumentListResponse>(res)
}

/**
 * Fetches a single document by ID.
 * Used for polling/checking in ingestion status after creating a document to see when it is ready and
 * when its chunks have been embedded and stored in database
 */
export async function getDocument(id: number): Promise<Document> {
  const res = await fetch(`${API_URL}/documents/${id}`,{
    credentials: "include",
  })
  return handleResponse<Document>(res)
}

/**
 * Update's a document's title. Content and souce URL cannot be changed
 */
export async function updateDocument(id: number, data: DocumentUpdateRequest): Promise<Document> {
  const res = await fetch(`${API_URL}/documents/${id}`, {
    method: "PATCH",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify(data)
  })

  return handleResponse<Document>(res)
}

/**
 * Deletes a document and all its chunks.
 */
export async function deleteDocument(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/documents/${id}`, {
    method: "DELETE",
    credentials: "include",
  })
  return handleResponse<void>(res)
}

// ─── Chat ───────────────────────────────────────────

export async function sendChatRequest(
  data: ChatRequest,
  onToken: (token: string) => void
): Promise<void> {
  const res = await fetch(`${API_URL}/chat/`, {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify(data)
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({detail: "Chat request failed"}))
    throw new Error(error.detail)
  }

  const reader = res.body?.getReader() //our chatbot is streaming so we ask for the response body as a stream to read piece-by-piece

  if (!reader) throw new Error("Streaming not supported")

    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()

      if (done) break
      onToken(decoder.decode(value))
    }
}


export async function listConversations(): Promise<ConversationListResponse> {
  const res = await fetch(`${API_URL}/chat/conversations/`, {
    credentials: "include",
  })
  return handleResponse<ConversationListResponse>(res)
}

export async function getConversation(id: number): Promise<Conversation> {
  const res = await fetch(`${API_URL}/chat/conversations/${id}`, {
    credentials: "include",
  })
  return handleResponse<Conversation>(res)
}

export async function deleteConversation(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/chat/conversations/${id}`, {
    method: "DELETE",
    credentials: "include"
  })
  return handleResponse<void>(res)
}