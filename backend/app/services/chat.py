from openai import OpenAI
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.models.tables import Document, DocumentChunk

import logging
import os
from app.config import OPEN_AI_KEY

logger = logging.getLogger(__name__)
client = OpenAI(api_key=OPEN_AI_KEY)


# Step 1: Embed the user question
def embed_question(question: str) -> list[float]:
  """
  embeds user's question into a vector so that it can be
  compared to document embeddings to find the most similar context to use
  for prompt augmentation
  Uses the same model as document ingestion for consistency.
  """

  response = client.embeddings.create(
    input = question,
    model = "text-embedding-3-small"
  )

  return response.data[0].embedding


# Step 2: Retrieve Relevant Chunks
def retrieve_chunks(
  embedding_question: list[float],
  user_id: int,
  db: Session,
  top_k: int = 5
) -> list[DocumentChunk]:
  """
    Find the most semantically similar chunks to the question.

    Uses pgvector's <=> operator (cosine distance).
    Lower distance = more similar = more relevant.

    Filters by user_id so users only search their own documents.
    Filters by status='ready' so only fully ingested documents are searched.
  """

  chunks = (
    db.query(DocumentChunk)
    .join(Document, Document.id == DocumentChunk.document_id)
    .filter(Document.user_id == user_id, Document.status == "ready")
    .order_by(DocumentChunk.embedding.op("<=>") (embedding_question))
    .limit(top_k)
    .all()
  )


  logger.info(f"Retrieved {len(chunks)} chunks for user {user_id}")
  return chunks

def build_context(chunks: list[DocumentChunk]) -> str:
  """
  Format retrieved chunks into a context string for the LLM prompt.
  """

  context_parts = []
  for i, chunk in enumerate(chunks):
    context_parts.append(f"[Source {i + 1}]: {chunk.chunk_text}")

  return "\n\n".join(context_parts)


def generate_answer_stream(question: str, chunks: list[DocumentChunk]):
  """
    Generator function that streams tokens from OpenAI.

    Why a generator? Because we want to yield tokens as they arrive
    rather than waiting for the complete response. This is what makes
    the "words appearing one by one" effect possible.
  """

  if not chunks:
    # no relevant chunks found — user asked about something not in their documents
    yield "I don't have enough information in your saved documents to answer that question. Try saving more relevant content first."
    return

  context = build_context(chunks)

  system_prompt = f"""You are a helpful assistant that answers questions based off the user's saved documents and context only to prevent any falser information.
  Here are the relevant contexts from the user's saved documents:

  {context}

  Rules:
  1. Answer using only the sources provided above.
  2. If the sources don't contain enough information to answer, respond with "I don't have enough information in your saved documents to answer that."
  3. Be concise and accurate
  4. Don't try to make up responses that are not true and are not present in any of the context.
  """

  stream = client.chat.completions.create(
        model="gpt-4o",
        stream=True,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question}
        ]
    )


  """
  OpenAI doesn't give you one complete response immediately.
  Instead, it sends pieces as the model generates them.
  Conceptually:

  "PostgreSQL"
  " uses"
  " B-tree"
  " indexes"
  " for"
  " efficient"
  " queries."

  Those individual pieces are what you're iterating over.
  """
  for chunk in stream:
    delta = chunk.choices[0].delta.content
    if delta:
      yield delta


