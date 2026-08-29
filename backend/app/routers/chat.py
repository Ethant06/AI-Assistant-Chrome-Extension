from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.tables import Conversation, Message, User, MessageSource, DocumentChunk, Document
from app.schemas.chat import (
  ChatRequest,
  ConversationListResponse,
  ConversationSummary,
  ConversationResponse
)

from app.services.chat import (
  embed_question,
  retrieve_chunks,
  generate_answer_stream,
  get_or_create_conversation,
  save_messages
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
  The main RAG endpoint.

  Takes a question, retrieves relevant chunks from the user's documents, streams an answer grounded in those chunks, then saves
  the conversation to the database.

  Returns a StreamingResponse - not JSON.
  Tokens arrive at the client as they're generated
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
    Inner generator that:
    1. Yields each token to the client (streaming)
    2. Accumulates tokens into a complete answer
    3. After streaming finishes, saves everything to DB
    """

    for token in generate_answer_stream(request.question, chunks):
      accumulated_answer.append(token)
      yield token

    full_answer = "".join(accumulated_answer)
    save_messages(
      conversation=conversation,
      question=request.question,
      answer=full_answer,
      chunks=chunks,
      db=db
    )
    logger.info(f"Chat complete: conversation_id={conversation.id}")

  return StreamingResponse(
    stream_and_save(),
    media_type="text/plain"
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
    Returns a full conversation with all messages and sources.
    Used when a user clicks on a past conversation to resume it.
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


