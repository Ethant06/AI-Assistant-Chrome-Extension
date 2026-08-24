from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

database_url = os.getenv('DATABASE_URL')

engine = create_engine(database_url)

SessionLocal = sessionmaker(autoflush=False, autocommit=False, bind=engine)

Base = declarative_base

def get_db():
  db = SessionLocal
  try:
    yield db
  finally:
    db.close()
