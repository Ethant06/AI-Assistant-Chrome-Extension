from openai import OpenAI
from sqlalchemy.orm import Session
from app.models.tables import Document, DocumentChunk
from app.database import SessionLocal
import logging, os
from app.config import OPEN_AI_KEY

client = OpenAI(api_key=OPEN_AI_KEY)

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 150) -> list[str]:
  """
    Splits text into overlapping chunks.

    chunk_size: (MAX) characters per chunk
    overlap: how many characters to repeat between chunks

    Why overlap? So context at chunk boundaries isn't lost.
    If a sentence spans two chunks, overlap ensures both chunks
    contain enough context to make sense of it.
  """
  chunks = []
  start = 0

  while start < len(text):
    end = start + chunk_size


    if end < len(text):
      boundary = text.rfind('. ', start, end)

      if boundary == -1:
        boundary = text.rfind('\n', start, end)
      if boundary == -1:
        boundary = text.rfind(' ', start, end)
      if boundary != -1:
        end = boundary + 1
