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

    chunk = text[start: end].strip()
    if chunk:
      chunks.append(chunk)

    start = end - overlap # this marks the start for the next chunk and ensures overlap - piece of first chunk.
  return chunks

def embed_text(text: str) -> list[float]:
  """
  Converts text to a vector of 1536 floats using OpenAI's embedding model
  This vector captures the semantic meaning of text through similar vectors
  cosine similarity
  """

  response = client.embeddings.create(
    input = text,
    model = "text-embedding-3-small"
  )

  return response.data[0].embedding

def ingest_document(document_id: int):
  """
  Full ingestion pipeline for documtns when created
  Runs as a background task the moment a document is created and submitted to database

  1. Retrieve matching document from DB
  2. Chunk raw content of document into smaller chunks
  3. Embed chunks into vectors
  4. Store chunks and embeddings to document_chunks table in DB
  5. Update Document DB object status attribute to ready
  """

  db: Session = SessionLocal()

  try:
