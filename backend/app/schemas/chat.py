from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class ChatRequest(BaseModel):
  """
  What the client sends when asking a question.

  question: the user's actual question
  conversation_id: optional - if provided, adds to existing conversation - Else starts a new conversation
  """

  question: str
  conversation_id: Optional[int] = None


class SourceResponse(BaseModel):
  """
  Represents one cited source in an answer.
  Shown below the AI response so user knows where the answer came from.

  chunk_id: which specific chunk was used
  document_title: human readable name of the source document
  source_url: link back to original page if it came from a url
  relevance_score: how similar this chunk was to the question (0 - 1)
  """
  model_config = ConfigDict(from_attributes=True)

  document_id: int
  document_title: str
  source_url: Optional[str] = None


class MessageResponse(BaseModel):
  """
  One message in a conversation.
  Role is either user or assistant
  """
  id: int
  role: str
  content: str
  created_at: datetime
  sources: list[SourceResponse] = []


class ConversationResponse(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  id: int
  title: Optional[str] = None
  created_at: datetime
  messages: list[MessageResponse] = []


class ConversationSummary(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  id: int
  title: Optional[str] = None
  created_at: datetime


class ConversationListResponse(BaseModel):
  conversations: list[ConversationSummary]
  total: int