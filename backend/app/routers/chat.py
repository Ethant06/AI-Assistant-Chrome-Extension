"""
app/routers/chat.py

RAG chat endpoints — the core user-facing feature of the application.

All endpoints require authentication (JWT Bearer token via get_current_user).
All queries filter by current_user.id — users only access their own conversations.

Routes:
    POST   /chat/                           main RAG endpoint, streams answer
    GET    /chat/conversations/             list all conversations (lightweight)
    GET    /chat/conversations/{id}         full conversation with messages + sources
    DELETE /chat/conversations/{id}         delete conversation + cascade messages
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.tables import Conversation, Message, User, MessageSource, DocumentChunk, Document
from app.schemas.chat import (
  ChatRequest,
  ConversationListResponse,
  ConversationSummary,
  ConversationResponse,
  InstantChatRequest
)

from app.services.chat import (
  embed_question,
  retrieve_chunks,
  generate_answer_stream,
  get_or_create_conversation,
  save_messages,
  retrieve_from_text,
  generate_answer_from_context
)

from app.dependencies.deps import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/")
def chat(
  request: ChatRequest,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user)
):

  """
    Main RAG endpoint — embeds the question, retrieves relevant chunks,
    streams a grounded answer, then saves the full conversation to the DB.

    Returns text/plain StreamingResponse (not JSON) — tokens arrive
    progressively as GPT generates them. Handle as a stream on the frontend.

    Conversation persistence happens after streaming completes, not during.
    Use GET /chat/conversations/{id} to retrieve the saved conversation
    with full messages and source citations after streaming finishes.

    "I don't know" detection: if the answer contains the fallback phrase,
    chunks are not saved as sources — the assistant message saves with sources=[].
  """

  logger.info(f"Chat request from user {current_user.email}: '{request.question[:50]}'")

  # step 1: embed the question
  question_embedding = embed_question(request.question)

  # step 2: retrieve relevant chunks
  chunks = retrieve_chunks(
    embedding_question=question_embedding,
    user_id = current_user.id,
    db=db,
    top_k=4
  )

  # step 3: get or create conversation
  conversation = get_or_create_conversation(
    user_id = current_user.id,
    conversation_id=request.conversation_id,
    question=request.question,
    db=db
  )

  # step 4: stream the answer
  # accumulate the tokens to save to Database after finish streaming
  accumulated_answer = []

  def stream_and_save():
    """
        Inner generator — serves two purposes simultaneously:
        1. Yields each token to the client as it arrives (streaming effect)
        2. Accumulates all tokens so the complete answer can be saved after

        Save happens after the last token is yielded — the full answer text
        is only known once streaming is complete.
    """

    for token in generate_answer_stream(request.question, chunks):
      accumulated_answer.append(token)
      yield token

    full_answer = "".join(accumulated_answer)

    has_answer = "don't have enough information" not in full_answer.lower()
    save_messages(
      conversation=conversation,
      question=request.question,
      answer=full_answer,
      chunks=chunks if has_answer else [],
      db=db
    )
    logger.info(f"Chat complete: conversation_id={conversation.id}")

  return StreamingResponse(
    stream_and_save(),
    media_type="text/plain",
    headers={"X-Conversation-Id": str(conversation.id)},
  )

@router.get("/conversations/", response_model=ConversationListResponse)
def list_conversations(
  db:Session = Depends(get_db),
  current_user: User = Depends(get_current_user)
):
  """
  returns all conversations for the current user.
  Lightweight - no messages loaded, just titles and metadata
  """

  conversations = (
    db.query(Conversation)
    .filter(Conversation.user_id == current_user.id)
    .order_by(Conversation.created_at.desc())
    .all()
    )

  total = len(conversations)
  logger.info(f"User {current_user.email} listed {total} conversations")

  return {
    "conversations": conversations,
    "total": total
  }

@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
def get_conversation(
  conversation_id: int,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user)
):

  """
    Returns a full conversation with all messages and source citations.

    joinedload chain pre-loads the entire relationship tree in one query:
    Conversation → messages → sources → chunk → document

    Why joinedload? Without it, SQLAlchemy uses lazy loading — each relationship
    access triggers a new DB query. By the time Pydantic serializes the response,
    the session is closed and lazy loading fails. joinedload ensures everything
    is loaded while the session is still open.
  """

  conversation = (
    db.query(Conversation)
    .options(
            joinedload(Conversation.messages)
            .joinedload(Message.sources)
            .joinedload(MessageSource.chunk)
            .joinedload(DocumentChunk.document)
        )
    .filter(Conversation.user_id == current_user.id, Conversation.id == conversation_id)
    .first()
  )

  if not conversation:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

  logger.info(f"User {current_user.email} opened conversation {conversation_id}")
  return conversation


# guard against embedding an enormous page — roughly 12k tokens
MAX_INSTANT_CHARS = 50_000

@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
  conversation_id: int,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user)
):
  """
    Deletes a conversation and all its messages (cascade).
  """

  conversation = (
    db.query(Conversation)
    .filter(Conversation.user_id == current_user.id, Conversation.id == conversation_id)
    .first()
  )

  if not conversation:
    raise HTTPException(status_code = status.HTTP_404_NOT_FOUND, detail = "Conversation not found")

  db.delete(conversation)
  db.commit()
  logger.info(f"Conversation {conversation_id} deleted by {current_user.email}")

@router.post("/instant")
def instant_chat(
  request: InstantChatRequest,
  current_user: User = Depends(get_current_user)
):
  """
  Answers a question about arbitrary page content, without saving anything.

  Powers the Chrome extension's "Ask now" mode: the user is reading a page
  and wants a quick answer without adding it to their knowledge base.

  Fully stateless — the content is chunked, embedded, and scored in memory,
  then discarded. No database session is needed, no conversation is created,
  and no MessageSource rows are written.

  Pages over MAX_INSTANT_CHARS are rejected rather than truncated, since a
  silently truncated answer would be misleading. The extension surfaces this
  as a prompt to save the page to the knowledge base instead.

  """
  logger.info(
        f"Instant chat from {current_user.email}: "
        f"'{request.question[:50]}' on {request.page_url or 'unknown page'}"
  )

  if len(request.page_content) > MAX_INSTANT_CHARS:
    raise HTTPException(
        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        detail="Page is too long for instant answers. Save it to your knowledge base instead."
  )

  if len(request.page_content.strip()) < 50:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Not enough content on this page to answer questions about."
  )

  relevant_chunks = retrieve_from_text(request.question, request.page_content)

  return StreamingResponse(
    generate_answer_from_context(request.question, relevant_chunks, request.page_title),
    media_type="text/plain"
  )
