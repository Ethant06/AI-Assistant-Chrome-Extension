"""
app/database.py

Database connection and session configuration.
All SQLAlchemy setup lives here — models import Base,
routers import get_db, background services import SessionLocal.

Three exports used across the application:
    Base         → imported by models/tables.py to define ORM models
    get_db       → FastAPI dependency injected into router functions
    SessionLocal → used directly by background tasks (ingestion, chat)
                   that run outside of a request context
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

database_url = os.getenv('DATABASE_URL')

engine = create_engine(database_url)

SessionLocal = sessionmaker(autoflush=False, autocommit=False, bind=engine)

Base = declarative_base()

def get_db():
  """
    FastAPI dependency that provides a database session per request.

    Used via Depends(get_db) in router function signatures.
    Yields a session so the router can use it, then closes it
    automatically when the request finishes — whether it succeeded or failed.

    Yields:
        Session: an active SQLAlchemy database session
  """

  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()
