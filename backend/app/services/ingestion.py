from openai import OpenAI
from sqlalchemy.orm import Session
from app.models.tables import Document, DocumentChunk
from app.database import SessionLocal
import logging, os
from app.config import OPEN_AI_KEY

client = OpenAI(api_key=OPEN_AI_KEY)

logger = logging.getLogger(__name__)

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 150) -> list[str]:
  """
    Splits raw document text into overlapping chunks for embedding.

    Why chunk all? Embedding an entire document as one vector loses ganularity - one vector cannot capture 1- different
    topics precisely. Smaller chunks allow retrieval to pinpoint exactly the relevant section rather than the whole document.

     Boundary detection priority (avoids cutting mid-sentence):
        1. Last '. ' (sentence end) before the chunk_size limit
        2. Last '\n' (paragraph break) if no sentence boundary found
        3. Last ' ' (word boundary) if no paragraph break found
        4. Hard cut at chunk_size if no whitespace found (rare edge case)

    Args:
        text: raw document content to split
        chunk_size: max characters per chunk (default 1000)
        overlap: characters repeated between consecutive chunks (default 150)

    Returns:
        List of non-empty string chunks, ordered as they appear in the document
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
  Converts a text string into a 1536-dimensional embedding vector.
  Uses OpenAI's text-embedding-3-small model.

  Args:
    text: the chunk text to embed

  Returns:
    List of 1536 floats representing the semantic meaning of the text
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

  Pipeline steps:
        1. Fetch document from DB — early return if not found
        2. Chunk raw_content into overlapping text segments
        3. Embed each chunk via OpenAI API → 1536-dimensional vector
        4. Save each chunk + embedding as a DocumentChunk row
        5. Update document status to 'ready' and set chunk_count
        6. On any failure → set status to 'failed' so UI can show error state

    Error handling strategy:
        - Per-chunk errors (OpenAI timeout, rate limit): log and skip that chunk,
          continue processing remaining chunks. Document still becomes 'ready'
          with slightly fewer chunks rather than failing entirely.
        - Pipeline-level errors (DB connection lost, document deleted mid-ingestion):
          caught by outer except, status set to 'failed', full traceback logged.
        - Session always closed in finally block to prevent connection pool leaks.

    Args:
        document_id: ID of the document to ingest (passed by BackgroundTasks)
  """

  db: Session = SessionLocal()

  try:
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
      logger.error(f"Ingestion failed: Document {document_id} not found.")
      return

    logger.info(f"Ingestion started: document_id={document_id} title='{document.title}'")
    chunks = chunk_text(document.raw_content)
    logger.info(f"Chunking Complete: {len(chunks)} chunks created for Document {document_id}")

    for index, chunk_text_content in enumerate(chunks):

      try:
        embedding = embed_text(chunk_text_content)

        chunk = DocumentChunk(
          document_id = document_id,
          chunk_text = chunk_text_content,
          chunk_index = index,
          embedding = embedding
        )
        db.add(chunk)

      except Exception as e:
        logger.error(f"Failed to embed chunk {index} for document {document_id}: {e}")
        continue

    document.status = "ready"
    document.chunk_count = len(chunks)
    db.commit()

    logger.info(f"Ingestion complete: document_id={document_id} chunks={len(chunks)} status=ready")


  except Exception as e:
    logger.error(f"Ingestion failed for document {document_id}: {e}", exc_info=True)

    try:
      document = db.query(Document).filter(Document.id == document_id).first()
      if document:
        document.status = "failed"
        db.commit()

    except:
      pass

  finally:
    db.close()

