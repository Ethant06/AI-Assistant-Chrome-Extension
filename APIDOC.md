# Knowledge Base API Documentation

**This API provides full functionality for the knowledge Base Assistant application It supports user authentication, document management, and AI-powered chat with retrieval-augmented generation (RAG).**


# routers/Auth

## *Register Endpoint*

**Request Format:** `/auth/register`

**Request Type:** POST

**Returned Data Format:** JSON object

**Description:** Creates a new user account with an email and password. Returns the new user's id and email on success. Passwords are stored as a bcrypt hash — never in plaintext.

**Example Request:**
```json
{
    "email": "user@example.com",
    "password": "securepassword"
}
```

**Example Response:**
```json
{
    "id": 1,
    "email": "user@example.com"
}
```

**Error Handling:**
```
400 — Email already registered
422 — Missing email or password
```
---

## *Login Endpoint (Web App)*

**Request Format:** `/auth/login`

**Request Type:** POST

**Returned Data Format:** JSON object

**Description:** Authenticates the user's credentials and sets an httpOnly cookie containing the JWT. The token is NOT returned in the response body — it lives in a cookie that JavaScript cannot read, protecting against XSS token theft. The browser stores and sends this cookie automatically on subsequent requests.

**Cookie flags set:**
```
httponly = true          JavaScript cannot read the cookie (XSS protection)
secure   = true in prod  HTTPS-only when deployed; disabled locally (HTTP)
samesite = lax           Blocks cross-site fetch requests (CSRF protection)
max_age  = 1800          Matches JWT expiry (30 minutes)
```

**Example Request:**
```json
{
    "username": "user@example.com",
    "password": "securepassword"
}
```

**Example Response:**
```json
{
    "message": "Logged in successfully"
}
```

**Frontend usage:** every subsequent request must include `credentials: "include"` so the browser sends the cookie:
```javascript
await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password })
})
```

**Note:** because the cookie is httpOnly, JavaScript cannot check whether the user is logged in by reading it. Call `GET /auth/me` to verify authentication status.

**Error Handling:**
```
401 — Invalid email or password
422 — Missing email or password
```

---

## *Login Endpoint (Chrome Extension)*

**Request Format:** `/auth/login/token`

**Request Type:** POST

**Returned Data Format:** JSON object

**Description:** Alternative login for the Chrome extension. Returns the raw JWT in the response body instead of setting a cookie. Chrome extensions run on a `chrome-extension://` origin, which the browser treats as cross-site relative to this API — cookies set with `samesite="lax"` are not sent from that origin. The extension stores this token in `chrome.storage.local` and attaches it manually as a Bearer header on every request.

**Example Request:**
```json
{
    "email": "user@example.com",
    "password": "securepassword"
}
```

**Example Response:**
```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer"
}
```

**Extension usage:**
```javascript
// store after login
await chrome.storage.local.set({ token: access_token })

// attach on every request
const { token } = await chrome.storage.local.get("token")
await fetch(`${API_URL}/documents/`, {
    headers: { "Authorization": `Bearer ${token}` }
})
```

**Error Handling:**
```
401 — Invalid email or password
422 — Missing email or password
```

---

## *Logout Endpoint*

**Request Format:** `/auth/logout`

**Request Type:** POST

**Returned Data Format:** JSON object

**Description:** Clears the auth cookie. Only relevant for the web app — the Chrome extension logs out by clearing its own `chrome.storage.local`, which requires no server call since the server holds no session state.

**Example Request:** No body

**Example Response:**
```json
{
    "message": "Logged out successfully"
}
```

**Frontend usage:**
```javascript
await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include"
})
```

**Error Handling:**
```
None — always succeeds, even if no cookie was set
```

---

# User Authentication Dependency

## *Get Current User Endpoint*

**Request Format:** `/auth/me`

**Request Type:** GET

**Auth Required:** Yes

**Returned Data Format:** JSON object

**Description:** Returns the currently authenticated user's id and email. Useful for displaying the logged-in user's info in the UI navbar or profile section.

**Example Request:** `/auth/me`

**Example Response:**
```json
{
    "id": 1,
    "email": "user@example.com"
}
```

**Error Handling:**
```
401 — Invalid or expired token
```


# routers/documents

## *Create Document Endpoint*

**Request Format:** `/documents/`

**Request Type:** POST

**Auth Required:** Yes

**Returned Data Format:** JSON object

**Description:** Saves a new document to the user's knowledge base and triggers the ingestion pipeline (chunking and embedding) as a background task. Always returns immediately with `status: "processing"` — poll `GET /documents/{id}` until status becomes `"ready"` before using the document in chat.

**Example Request:**
```json
{
    "title": "Introduction to PostgreSQL Indexes",
    "source_url": "https://postgresql.org/docs/indexes",
    "raw_content": "PostgreSQL provides several index types to optimize query performance..."
}
```

**Fields:**
```
title       — required, display name for the document
raw_content — required, full text content to chunk and embed
source_url  — optional, null if content was manually pasted
```

**Example Response:**
```json
{
    "id": 1,
    "title": "Introduction to PostgreSQL Indexes",
    "source_url": "https://postgresql.org/docs/indexes",
    "status": "processing",
    "word_count": 342,
    "chunk_count": null,
    "created_at": "2026-08-29T16:28:18.968689"
}
```

**Status Values:**
```
"processing" — ingestion pipeline running, document not yet searchable
"ready"      — fully ingested, available for RAG queries
"failed"     — ingestion failed, delete and re-upload to retry
```

**Error Handling:**
```
401 — Not authenticated
422 — Missing title or raw_content
```

---

## *List Documents Endpoint*

**Request Format:** `/documents/`

**URL Query Parameters:** `page`, `page_size`

**Request Type:** GET

**Auth Required:** Yes

**Returned Data Format:** JSON object containing array

**Description:** Returns a paginated list of all documents belonging to the current user, ordered newest first. Use `total` to determine if more pages exist: `has_more = (page * page_size) < total`.

**Example Request:** `/documents/?page=1&page_size=10`

**Example Response:**
```json
{
    "documents": [
        {
            "id": 2,
            "title": "PostgreSQL Index Types",
            "source_url": null,
            "status": "ready",
            "word_count": 523,
            "chunk_count": 8,
            "created_at": "2026-08-29T16:28:18.968689"
        },
        {
            "id": 1,
            "title": "Introduction to PostgreSQL Indexes",
            "source_url": "https://postgresql.org/docs",
            "status": "processing",
            "word_count": 342,
            "chunk_count": null,
            "created_at": "2026-08-28T10:15:00.000000"
        }
    ],
    "total": 2,
    "page": 1,
    "page_size": 10
}
```

**Nullable Fields:**
```
source_url  — null when content was manually pasted
chunk_count — null while status is "processing"
```

**Error Handling:**
```
401 — Not authenticated
```

---

## *Get Document Endpoint*

**Request Format:** `/documents/:id`

**URL Parameter:** `id`

**Request Type:** GET

**Auth Required:** Yes

**Returned Data Format:** JSON object

**Description:** Returns a single document by ID. A user can only retrieve their own documents — passing another user's document ID returns 404.

**Example Request:** `/documents/1`

**Example Response:**
```json
{
    "id": 1,
    "title": "Introduction to PostgreSQL Indexes",
    "source_url": "https://postgresql.org/docs",
    "status": "ready",
    "word_count": 342,
    "chunk_count": 6,
    "created_at": "2026-08-29T16:28:18.968689"
}
```

**Error Handling:**
```
401 — Not authenticated
404 — Document not found or belongs to another user
```

---

## *Update Document Endpoint*

**Request Format:** `/documents/:id`

**URL Parameter:** `id`

**Request Type:** PATCH

**Auth Required:** Yes

**Returned Data Format:** JSON object

**Description:** Updates the document's title. Only the title can be changed — updating raw content or source URL would invalidate existing embeddings. Delete and re-upload if content needs to change.

**Example Request:**
```json
{
    "title": "Updated Document Title"
}
```

**Example Response:**
```json
{
    "id": 1,
    "title": "Updated Document Title",
    "source_url": "https://postgresql.org/docs",
    "status": "ready",
    "word_count": 342,
    "chunk_count": 6,
    "created_at": "2026-08-29T16:28:18.968689"
}
```

**Error Handling:**
```
401 — Not authenticated
404 — Document not found or belongs to another user
422 — Missing title
```

---

## *Delete Document Endpoint*

**Request Format:** `/documents/:id`

**URL Parameter:** `id`

**Request Type:** DELETE

**Auth Required:** Yes

**Returned Data Format:** No content

**Description:** Deletes a document and all its associated chunks. Returns 204 with no response body on success. Any source citations in past conversations that referenced this document's chunks will have their chunk_id set to null — the citation record is preserved but no longer links to a chunk.

**Example Request:** `/documents/1`

**Example Response:**
```
204 No Content
```

**Error Handling:**
```
401 — Not authenticated
404 — Document not found or belongs to another user
```
---

# routers/chat

## *Chat Endpoint*

**Request Format:** `/chat/`

**Request Type:** POST

**Auth Required:** Yes

**Returned Data Format:** text/plain stream

**Description:** The main RAG endpoint. Embeds the user's question, retrieves the most relevant chunks from their saved documents, and streams a grounded answer token by token. Does not return JSON — handle the response as a stream. After streaming completes, the conversation, both messages, and source citations are automatically saved to the database.

**Example Request:**
```json
{
    "question": "What is a B-tree index and when should I use it?",
    "conversation_id": null
}
```

**Fields:**
```
question        — required, the user's question
conversation_id — optional, null starts a new conversation,
                  an existing ID continues that conversation
```

**Example Response:**
```
A B-tree index is the default index type in PostgreSQL. It organizes
data in a balanced tree structure, allowing for O(log n) lookups...
```
*(tokens arrive progressively, not all at once)*

**"I don't know" response (when documents don't contain relevant info):**
```
I don't have enough information in your saved documents to answer that
question. Try saving more relevant content first.
```

**Frontend streaming pattern:**
```javascript
const response = await fetch(`${API_URL}/chat/`, {
    method: "POST",
    headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    },
    body: JSON.stringify({ question, conversation_id })
})

const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
    const { done, value } = await reader.read()
    if (done) break
    setAnswer(prev => prev + decoder.decode(value))
}
```

**Error Handling:**
```
401 — Not authenticated
422 — Missing question field
```

---

## *List Conversations Endpoint*

**Request Format:** `/chat/conversations/`

**Request Type:** GET

**Auth Required:** Yes

**Returned Data Format:** JSON object containing array

**Description:** Returns all conversations for the current user, ordered newest first. Lightweight — no messages included. Use this to populate a conversations sidebar. Fetch the full conversation with GET /chat/conversations/:id when the user clicks one.

**Example Request:** `/chat/conversations/`

**Example Response:**
```json
{
    "conversations": [
        {
            "id": 3,
            "title": "What is a B-tree index and when should I use it?",
            "created_at": "2026-08-29T16:28:18.968689"
        },
        {
            "id": 2,
            "title": "What is the difference between GiST and GIN indexes?",
            "created_at": "2026-08-28T14:11:03.000000"
        }
    ],
    "total": 2
}
```

**Notes:**
```
title is set to the first question asked, truncated to 100 characters
messages are not included — use GET /chat/conversations/:id for full data
```

**Error Handling:**
```
401 — Not authenticated
```

---

## *Get Conversation Endpoint*

**Request Format:** `/chat/conversations/:id`

**URL Parameter:** `id`

**Request Type:** GET

**Auth Required:** Yes

**Returned Data Format:** JSON object

**Description:** Returns a full conversation with all messages and source citations. Messages are ordered by id ascending — the user message always appears before the assistant response. User messages always have an empty sources array. Assistant messages have sources populated with the documents that were cited in the answer.

**Example Request:** `/chat/conversations/3`

**Example Response:**
```json
{
    "id": 3,
    "title": "What is a B-tree index and when should I use it?",
    "created_at": "2026-08-29T16:28:18.968689",
    "messages": [
        {
            "id": 17,
            "role": "user",
            "content": "What is a B-tree index and when should I use it?",
            "created_at": "2026-08-29T16:28:18.968689",
            "sources": []
        },
        {
            "id": 18,
            "role": "assistant",
            "content": "A B-tree index is the default index type in PostgreSQL...",
            "created_at": "2026-08-29T16:28:18.968689",
            "sources": [
                {
                    "document_id": 1,
                    "document_title": "Introduction to PostgreSQL Indexes",
                    "source_url": "https://postgresql.org/docs/indexes"
                }
            ]
        }
    ]
}
```

**Source Fields:**
```
document_id    — use to link to GET /documents/:id
document_title — display as the citation label in UI
source_url     — make clickable if not null, hide if null
```

**Error Handling:**
```
401 — Not authenticated
404 — Conversation not found or belongs to another user
```

---

## *Delete Conversation Endpoint*

**Request Format:** `/chat/conversations/:id`

**URL Parameter:** `id`

**Request Type:** DELETE

**Auth Required:** Yes

**Returned Data Format:** No content

**Description:** Deletes a conversation and all its messages and source citations. Returns 204 with no response body on success.

**Example Request:** `/chat/conversations/3`

**Example Response:**
```
204 No Content
```

**Error Handling:**
```
401 — Not authenticated
404 — Conversation not found or belongs to another user
```