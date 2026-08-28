from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.tables import Conversation, Message, User
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
    question_embedding=question_embedding,
    user_id = current_user.id,
    db=db,
    top=4
  )

  # step 3: get or create conversation
  conversation = get_or_create_conversation(
    user_id = current_user.id,
    conversation_id=request.conversation_id,
    question=request.question,
    db=db
  )