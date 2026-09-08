"""
app/routers/documents.py

CRUD endpoints for managing documents in a user's knowledge base.

All endpoints require authentication (JWT Bearer token via get_current_user).
All queries filter by current_user.id — users can only access their own documents.

Routes:
    POST   /documents/          create document + trigger ingestion
    GET    /documents/          list documents (paginated)
    GET    /documents/events    live document changes (SSE)
    GET    /documents/{id}      get single document
    PATCH  /documents/{id}      update document title
    DELETE /documents/{id}      delete document + cascade chunks
"""

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.dependencies.deps import get_current_user
from app.models.tables import Document, User
from app.schemas.documents import DocumentCreate, DocumentResponse, DocumentListResponse, DocumentUpdate
from app.services.document_events import publish_document_event, subscribe, unsubscribe
from app.services.ingestion import ingest_document_async

logger = logging.getLogger(__name__)
router = APIRouter(
  prefix = "/documents",
  tags = ["documents"]
)

@router.post("/", response_model=DocumentResponse)
def create_document(
  data: DocumentCreate,
  background_tasks: BackgroundTasks,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user)
  ):

  """
    Saves a new document and triggers the ingestion pipeline as a background task.

    Returns immediately with status='processing' — ingestion (chunking + embedding)
    runs asynchronously after the response is sent. Poll GET /documents/{id}
    until status changes to 'ready' before using the document in chat.
  """
  word_count = len(data.raw_content.split())

  document = Document(
    user_id = current_user.id,
    title = data.title,
    source_url = data.source_url,
    raw_content = data.raw_content,
    status="processing",
    word_count=word_count
  )

  db.add(document)
  db.commit()
  db.refresh(document)

    # kick off ingestion after commit — document.id is now available
    # runs after this response is returned, not before
  background_tasks.add_task(ingest_document_async, document.id)

  logger.info(f"Document created: id={document.id} user={current_user.email}")
  publish_document_event(current_user.id, "created", document)
  return document

@router.get("/", response_model=DocumentListResponse)
def list_documents(
  page: int = 1,
  page_size: int = 10,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user)
):
  """
    Returns a paginated list of the current user's documents, newest first.

    total reflects the full count across all pages — use it to calculate
    whether more pages exist: has_more = (page * page_size) < total
  """

  offset = (page - 1) * page_size
  total = db.query(Document).filter(Document.user_id == current_user.id).count()

  documents = (
    db.query(Document)
    .filter(Document.user_id == current_user.id)
    .order_by(Document.created_at.desc())
    .offset(offset)
    .limit(page_size)
    .all()
  )

  return {
    "documents": documents,
    "total": total, # total documents
    "page": page,
    "page_size": page_size
  }


@router.get("/events")
async def document_events(request: Request):
  """
  Server-sent events for the current user's documents.

  The Library stays subscribed while it is open. Create / update / delete
  from the web app or the Chrome extension is pushed immediately — no poll.
  Auth is resolved once, then the DB session is closed so a long-lived
  stream does not hold a connection.
  """
  db = SessionLocal()
  try:
    user = get_current_user(request, db)
    user_id = user.id
  finally:
    db.close()

  queue = subscribe(user_id)

  async def generate():
    try:
      # A data frame (not a comment) so proxies flush headers immediately.
      yield f"data: {json.dumps({'type': 'ping', 'id': 0, 'document': None})}\n\n"
      while True:
        if await request.is_disconnected():
          break
        try:
          event = await asyncio.wait_for(queue.get(), timeout=15)
          yield f"data: {json.dumps(event)}\n\n"
        except asyncio.TimeoutError:
          yield f"data: {json.dumps({'type': 'ping', 'id': 0, 'document': None})}\n\n"
    finally:
      unsubscribe(user_id, queue)

  return StreamingResponse(
    generate(),
    media_type="text/event-stream",
    headers={
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  )


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
  document_id: int,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user)
):

  """
    Returns a single document by ID.

    Filters by both document_id AND user_id — a user cannot access
    another user's document even if they know the ID.
  """
  document = db.query(Document).filter(Document.user_id == current_user.id).filter(Document.id == document_id).first()

  if not document:
    logger.warning(f"Document {document_id} not found for user {current_user.email}")
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

  return document

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
  document_id: int,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user)
):

  """
    Deletes a document and all associated chunks (cascade).

    Returns 204 No Content on success — no response body.
    Cascade deletion of DocumentChunk rows is handled automatically
    by the relationship cascade defined in the Document model.
  """

  document = (
    db.query(Document)
    .filter(Document.user_id == current_user.id, Document.id == document_id)
    .first()
  )

  if not document:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

  document_id_deleted = document.id
  db.delete(document)
  db.commit()
  publish_document_event(current_user.id, "deleted", document_id=document_id_deleted)

@router.patch("/{document_id}", response_model=DocumentResponse)
def update_document(
  document_id: int,
  data: DocumentUpdate,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user)
):

  """
    Updates the document title only.

    raw_content and source_url cannot be updated — changing content would
    invalidate existing embeddings. Delete and re-upload to change content.
  """

  document= db.query(Document).filter(Document.id == document_id, current_user.id == Document.user_id).first()
  if not document:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
  document.title = data.title
  db.commit()
  db.refresh(document)
  publish_document_event(current_user.id, "updated", document)
  return document




"""
THIS IS TO BE ADDED LATER ON FOR FULL CONTENT DISPLAY
@router.get("/{document_id}/content")
def get_document_content(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    Returns a document's full raw content.

    Separate from GET /documents/{id} because raw_content can be tens of
    thousands of characters — including it in every list and detail
    response would bloat payloads for data that's rarely needed.
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return {"id": document.id, "title": document.title, "raw_content": document.raw_content}

"""
