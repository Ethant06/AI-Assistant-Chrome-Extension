from openai import OpenAI
from sqlalchemy.orm import Session
from app.models.tables import Document, DocumentChunk
from app.database import SessionLocal
import asyncio
import logging
from app.config import OPENAI_API_KEY
from app.services.document_events import publish_document_event

client = OpenAI(api_key=OPENAI_API_KEY)

logger = logging.getLogger(__name__)

# OpenAI allows many inputs per embeddings request. 64 stays well
# under the 2048-input / token caps and keeps a failed batch small.
EMBED_BATCH_SIZE = 64
EMBED_MODEL = "text-embedding-3-small"


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 150) -> list[str]:
  """
    Splits raw document text into overlapping chunks for embedding.

    Why chunk all? Embedding an entire document as one vector loses ganularity - one vector cannot capture 1- different
    topics precisely. Smaller chunks allow retrieval to pinpoint exactly the relevant section rather than the whole document.

     Boundary detection priority (avoids cutting mid-sentence):
        1. Last '. ' (sentence end) before the chunk_size limit
        2. Last '\\n' (paragraph break) if no sentence boundary found
        3. Last ' ' (word boundary) if no paragraph break found
        4. Hard cut at chunk_size if no whitespace found (rare edge case)

    start always advances. A boundary at the current start used to send
    start backwards and loop forever on some pages.

    Args:
        text: raw document content to split
        chunk_size: max characters per chunk (default 1000)
        overlap: characters repeated between consecutive chunks (default 150)

    Returns:
        List of non-empty string chunks, ordered as they appear in the document
  """
  if not text or not text.strip():
    return []

  chunks = []
  start = 0
  n = len(text)

  while start < n:
    end = min(start + chunk_size, n)

    if end < n:
      boundary = text.rfind('. ', start, end)

      if boundary == -1:
        boundary = text.rfind('\n', start, end)
      if boundary == -1:
        boundary = text.rfind(' ', start, end)
      if boundary != -1 and boundary + 1 > start:
        end = boundary + 1

    chunk = text[start:end].strip()
    if chunk:
      chunks.append(chunk)

    next_start = end - overlap if end < n else n
    if next_start <= start:
      next_start = end
    if next_start <= start:
      break
    start = next_start

  return chunks


def embed_texts(texts: list[str]) -> list[list[float]]:
  """
  Embeds many strings with as few OpenAI calls as possible.

  OpenAI accepts a list on `input`. One request per EMBED_BATCH_SIZE
  items — not one request per chunk, and not all 1000 chunks in one
  payload (that can hit token / request-size limits).
  """
  if not texts:
    return []

  embeddings: list[list[float]] = []
  for i in range(0, len(texts), EMBED_BATCH_SIZE):
    batch = texts[i:i + EMBED_BATCH_SIZE]
    response = client.embeddings.create(
      input=batch,
      model=EMBED_MODEL,
    )
    embeddings.extend(item.embedding for item in response.data)
  return embeddings


async def ingest_document_async(document_id: int):
  """
  Runs ingest_document in a thread so a long page does not freeze
  the API event loop (chat / library requests would stall).
  """
  await asyncio.to_thread(ingest_document, document_id)


def ingest_document(document_id: int):
  """
  Full ingestion pipeline for documents when created.
  Runs as a background task after a document is saved.

  Pipeline steps:
        1. Fetch document from DB — early return if not found
        2. Chunk raw_content into overlapping text segments
        3. Embed chunks in batches via OpenAI → 1536-dimensional vectors
        4. Save each chunk + embedding as a DocumentChunk row
        5. Update document status to 'ready' and set chunk_count
        6. On any failure → set status to 'failed' so UI can show error state

    A document is only marked ready if at least one embedding was saved.
    Chat searches status='ready' rows; ready + zero chunks looks ingested
    but cannot answer questions.

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
    chunks = chunk_text(document.raw_content or "")
    logger.info(f"Chunking Complete: {len(chunks)} chunks created for Document {document_id}")

    if not chunks:
      document.status = "failed"
      document.chunk_count = 0
      db.commit()
      publish_document_event(document.user_id, "updated", document)
      logger.error(f"Ingestion failed: document {document_id} produced no chunks")
      return

    saved = 0
    for batch_start in range(0, len(chunks), EMBED_BATCH_SIZE):
      batch = chunks[batch_start:batch_start + EMBED_BATCH_SIZE]
      try:
        embeddings = embed_texts(batch)
      except Exception as e:
        logger.error(
          f"Failed to embed chunks {batch_start}-{batch_start + len(batch) - 1} "
          f"for document {document_id}: {e}"
        )
        continue

      for offset, (chunk_text_content, embedding) in enumerate(zip(batch, embeddings)):
        db.add(DocumentChunk(
          document_id=document_id,
          chunk_text=chunk_text_content,
          chunk_index=batch_start + offset,
          embedding=embedding,
        ))
        saved += 1

    if saved == 0:
      document.status = "failed"
      document.chunk_count = 0
      db.commit()
      publish_document_event(document.user_id, "updated", document)
      logger.error(f"Ingestion failed: no embeddings saved for document {document_id}")
      return

    document.status = "ready"
    document.chunk_count = saved
    db.commit()
    publish_document_event(document.user_id, "updated", document)

    logger.info(f"Ingestion complete: document_id={document_id} chunks={saved} status=ready")

  except Exception as e:
    logger.error(f"Ingestion failed for document {document_id}: {e}", exc_info=True)
    db.rollback()

    try:
      document = db.query(Document).filter(Document.id == document_id).first()
      if document:
        document.status = "failed"
        db.commit()
        publish_document_event(document.user_id, "updated", document)
    except Exception:
      pass

  finally:
    db.close()
