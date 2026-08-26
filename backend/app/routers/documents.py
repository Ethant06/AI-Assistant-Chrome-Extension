from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.tables import Document
from app.schemas.documents import DocumentCreate, DocumentResponse, DocumentListResponse
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
)
