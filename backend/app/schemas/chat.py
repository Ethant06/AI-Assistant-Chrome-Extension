from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class ChatRequest(BaseModel):
  """
  input schema for POST/chat/

  conversation_id is optional - null starts a new conversation,
  an existing ID continues that conversation thread
  """
  question: str
  conversation_id: Optional[int] = None


class SourceResponse(BaseModel):
  """
  One cited document shown below an assistant message.

  Populated via @property methods on MessageSource model - these fields do not exist directly
  on MessageSource but are traversded from Chunk -> document at serialization time.
  """
  model_config = ConfigDict(from_attributes=True)

  document_id: int
  document_title: str
  source_url: Optional[str] = None # make clickable if not null


class MessageResponse(BaseModel):
  """
  One message in a conversation.

  role is always "user" or "assistant"
  sources exist only for assistant
  """
  id: int
  role: str
  content: str
  created_at: datetime
  sources: list[SourceResponse] = []


class ConversationResponse(BaseModel):
  """
  full conversation with all messages and citations.
  Used by GET / CHAT/conversations/{id} in routers/chat
  """
  model_config = ConfigDict(from_attributes=True)

  id: int
  title: Optional[str] = None
  created_at: datetime
  messages: list[MessageResponse] = []


class ConversationSummary(BaseModel):
  """
  Lightweight conversation object for list views.
  Used inside ConversationListResponse for GET /chat/conversations/

  Intentionally excludes messages - loading all messages just for a sidebar of conversation is wasteful.
  We only use ConversationResponse when the full conversation is needed.
  """
  model_config = ConfigDict(from_attributes=True)

  id: int
  title: Optional[str] = None
  created_at: datetime


class ConversationListResponse(BaseModel):
  """
  Paginated list of conversations for GET /chat/conversations/
  Ordered by created_at descending (newest first)
  """

  conversations: list[ConversationSummary]
  total: int # total count across all pages, not just this page.