from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# What the client sends when saving a document
# notice raw_content is never in documentresponse since we never send full raw content back into list responses since it can be thousands of words
class DocumentCreate(BaseModel):
  title: str
  source_url: Optional[str] = None
  raw_content: str

# what the client gets back for a single document
class DocumentResponse(BaseModel):
  id: int
  title: str
  source_url: Optional[str] = None
  status: str
  word_count: Optional[int] = None
  chunk_count: Optional[int] = None
  created_at: datetime

  class Config:
    from_attributes = True


# what the client gets back when listing documents (paginated)
class DocumentListResponse(BaseModel):
  documents: list[DocumentResponse]
  total: int
  page: int
  page_size: int

