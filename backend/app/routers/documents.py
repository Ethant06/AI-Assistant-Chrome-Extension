from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.tables import Document
from app.schemas.documents import DocumentCreate, DocumentResponse, DocumentListResponse, DocumentUpdate
from app.dependencies.deps import get_current_user
from app.models.tables import User
import logging

logger = logging.getLogger(__name__)
router = APIRouter(
  prefix = "/documents",
  tags = ["documents"]
)

@router.post("/", response_model=DocumentResponse)
def create_document(
  data: DocumentCreate,
  background_tasks: BackgroundTasks,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user)
  ):
  word_count = len(data.raw_content.split())

  document = Document(
    user_id = current_user.id,
    title = data.title,
    source_url = data.source_url,
    raw_content = data.raw_content,
    status="processing",
    word_count=word_count
  )

  db.add(document)
  db.commit()
  db.refresh(document)

    # trigger ingestion pipeline as background task
    # we'll implement this function in feature/ingestion
    # background_tasks.add_task(ingest_document, document.id)

  logger.info(f"Document created: id={document.id} user={current_user.email}")
  return document

@router.get("/", response_model=DocumentListResponse)
def list_documents(
  page: int = 1,
  page_size: int = 10,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user)
):
  offset = (page - 1) * page_size
  total = db.query(Document).filter(Document.user_id == current_user.id).count()

  documents = (
    db.query(Document)
    .filter(Document.user_id == current_user.id)
    .order_by(Document.created_at.desc())
    .offset(offset)
    .limit(page_size)
    .all()
  )

  return {
    "documents": documents,
    "total": total,
    "page": page,
    "page_size": page_size
  }

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
  document_id: int,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user)
):
  document = db.query(Document).filter(Document.user_id == current_user.id).filter(Document.id == document_id).first()

  if not document:
    logger.warning(f"Document {document_id} not found for user {current_user.email}")
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

  return document

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
  document_id: int,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user)
):

  document = (
    db.query(Document)
    .filter(Document.user_id == current_user.id, Document.id == document_id)
    .first()
  )

  if not document:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

  db.delete(document)
  db.commit()

@router.patch("/{document_id}", response_model=DocumentResponse)
def update_document(
  document_id: int,
  data: DocumentUpdate,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user)
):

  document= db.query(Document).filter(Document.id == document_id, current_user.id == Document.user_id).first()
  if not document:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
  document.title = data.title
  db.commit()
  db.refresh(document)
  return document