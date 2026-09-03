from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class DocumentUpdate(BaseModel):
  """
  Input schema for PATCH /documents/{id}

  Only title can be updated - changing source-url or raw_content would invalidate existing embeddings.
  """
  title: str


class DocumentCreate(BaseModel):
  """
  Input schema for POST /documents/

  raw_content is required - the full text to chunk and embed
  """

  title: str
  source_url: Optional[str] = None
  raw_content: str


class DocumentResponse(BaseModel):
  """
  Output schema for single document

  raw_content is excluded since it can be thousands of words and is never displayed by frontend

  """
  model_config = ConfigDict(from_attributes=True)

  id: int
  title: str
  source_url: Optional[str] = None
  status: str
  word_count: Optional[int] = None
  chunk_count: Optional[int] = None
  created_at: datetime
  excerpt: Optional[str] = None #first ~200 characters of raw_content


class DocumentListResponse(BaseModel):
  """
  Output schema for GET /documents/

  Paginated - use page and page_size query parans to navigate.
  """

  documents: list[DocumentResponse]
  total: int
  page: int
  page_size: int

