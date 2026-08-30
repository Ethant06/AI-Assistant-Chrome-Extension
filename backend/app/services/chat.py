from openai import OpenAI
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.models.tables import Document, DocumentChunk, Conversation, Message, MessageSource

import logging
import os
from app.config import OPEN_AI_KEY

logger = logging.getLogger(__name__)
client = OpenAI(api_key=OPEN_AI_KEY)

"""
flush() sends the SQL to the database and gets you the auto-generated ID,
but doesn't permanently commit the transaction. This means if something fails later,
the whole thing rolls back cleanly. You commit once at the very end when everything is ready.
"""

# Step 1: Embed the user question
def embed_question(question: str) -> list[float]:
  """
  Converts the user's question into a 1536-dimensional embedding vector.

  Args:
        question: the raw question string from the user

    Returns:
        List of 1536 floats representing the question's semantic meaning
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
    Finds the most semantically relevant document chunks for the question.

    Uses pgvector's <=> cosine distance operator — lower distance means
    higher similarity means more relevant. Results are ordered most
    relevant first, so chunks[0] is always the best match.

    Two filters applied for correctness and security:
    - user_id: users can only search their own documents (never another user's)
    - status='ready': skips documents still processing or failed ingestion

    Args:
        embedding_question: 1536-dim vector of the embedded question
        user_id: authenticated user's ID — scopes search to their documents only
        db: SQLAlchemy session
        top_k: number of chunks to return (default 5)

    Returns:
        List of DocumentChunk objects ordered by relevance (most relevant first)
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
  Formats retrieved chunks into a numbered context string for the LLM prompt.

    Each chunk is labeled [Source N] so the LLM can reference which source
    supports each part of its answer. The numbering corresponds to retrieval
    rank — [Source 1] is always the most relevant chunk.

    Args:
        chunks: retrieved DocumentChunk objects, ordered by relevance

    Returns:
        Single string with all chunks joined by double newlines
  """

  context_parts = []
  for i, chunk in enumerate(chunks):
    context_parts.append(f"[Source {i + 1}]: {chunk.chunk_text}")

  return "\n\n".join(context_parts)


# Step 3: Generate streamed answer
def generate_answer_stream(question: str, chunks: list[DocumentChunk]):
  """
    Generator that streams GPT-4o tokens as they are generated.

    Why a generator with yield instead of returning the full answer?
    OpenAI sends the response token by token as it generates. yield passes
    each token to the caller immediately rather than waiting for completion.
    This is what produces the "words appearing one by one" effect in the UI.

    "I don't know" handling: if no chunks were retrieved (user asked about
    something not in their documents), skip the OpenAI call entirely and
    yield a clear message. This prevents hallucination — the LLM is never
    called without grounding context.

    Yields:
        Individual token strings as they arrive from OpenAI's streaming API
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


# Step 4: Saving conversation to database
def get_or_create_conversation(
  user_id: int,
  conversation_id: int | None,
  question: str,
  db: Session
  ) -> Conversation:
    """
    Returns an existing conversation or creates a new one.

    Two paths:
    - conversation_id provided → fetch and verify it belongs to this user.
      If not found (deleted or wrong user), fall through to create a new one.
    - conversation_id is None → always create a new conversation.

    Title is set to the first question, truncated to 100 chars.
    This gives conversations a meaningful sidebar label without
    requiring a separate title input from the user.

    Why db.flush() instead of db.commit()?
    flush() sends the INSERT to the DB and returns the auto-generated
    conversation.id without permanently committing the transaction.
    The full commit happens in save_messages() after everything is saved,
    keeping the entire interaction atomic — either all saves succeed or none do.

    Args:
        user_id: authenticated user's ID
        conversation_id: existing conversation to continue, or None for new
        question: the user's question — used as the conversation title if new
        db: SQLAlchemy session

    Returns:
        Conversation object (existing or newly created)
    """

    if conversation_id:
      conversation = (
        db.query(Conversation)
        .filter(
          Conversation.id == conversation_id,
          Conversation.user_id == user_id
        )
        .first()
      )
      if not conversation:

        conversation = None

    if not conversation_id or not conversation:
      #truncate title to 100 chars - shorter question titles
      title = question[:100] + "..." if len(question) > 100 else question
      conversation = Conversation(user_id = user_id, title = title)
      db.add(conversation)
      db.flush() # to get the conversation.id without commiting it permanently yet. This is like staging

    return conversation

def save_messages(conversation: Conversation, question: str, answer: str, chunks: list[DocumentChunk], db: Session):
    """
    Persists the full conversation turn to the database after streaming completes.

    Called only after streaming finishes — the complete answer text is needed
    before saving. Saving mid-stream would store an incomplete response.

    Saves three things atomically in one commit:
    1. User message (role='user', no sources)
    2. Assistant message (role='assistant', with sources)
    3. MessageSource rows — one per unique cited document

    Source deduplication: multiple chunks from the same document produce only
    one MessageSource row. seen_document_ids tracks which documents have been
    cited to prevent duplicate citations in the UI.

    Args:
        conversation: the Conversation object to attach messages to
        question: the user's original question text
        answer: the complete streamed answer (accumulated after streaming)
        chunks: retrieved chunks used as context (empty if no answer found)
        db: SQLAlchemy session (shared with get_or_create_conversation)
    """

    # save user message
    user_message = Message(
      conversation_id = conversation.id,
      role="user",
      content=question
    )
    db.add(user_message)
    db.flush() # get user_message.id

    # save assistant message
    assistantMessage = Message(
      conversation_id = conversation.id,
      role="assistant",
      content=answer
    )
    db.add(assistantMessage)
    db.flush() # get assistant_message.id

    seen_document_ids = set()
    for chunk in chunks:
      if chunk.document_id not in seen_document_ids:
        seen_document_ids.add(chunk.document_id)
        source = MessageSource(
          message_id=assistantMessage.id,
          chunk_id=chunk.id
        )

        db.add(source)

    db.commit()
    logger.info(
        f"Saved conversation_id={conversation.id} "
    )
