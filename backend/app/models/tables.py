from sqlalchemy import Column, String, ForeignKey, Table, Integer, Text, DateTime, Float
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
from sqlalchemy import func
from pgvector.sqlalchemy import Vector

# relationship for document.user -> user
# document is just a User attribute
class User(Base):
  __tablename__ = "users"
  id = Column(Integer, primary_key=True)
  email = Column(String, unique=True, nullable=False)
  hashed_password = Column(String, nullable=False)
  created_at = Column(DateTime, server_default=func.now())
  documents = relationship("Document", back_populates="user")

# relationship for user.documents -> [Document, Document]
# user is just a Document class attribute
class Document(Base):
  __tablename__ = "documents"
  id = Column(Integer, primary_key=True)
  user_id = Column(Integer, ForeignKey("users.id"))
  title = Column(String, nullable=False)
  source_url = Column(String)
  raw_content = Column(Text)
  status = Column(String)
  created_at = Column(DateTime, server_default=func.now())
  word_count = Column(Integer)
  chunk_count = Column(Integer)
  chunks = relationship("DocumentChunk", back_populates="document")
  user = relationship('User', back_populates='documents')

class DocumentChunk(Base):
  __tablename__ = "document_chunks"
  id = Column(Integer, primary_key=True)
  document_id = Column(Integer, ForeignKey("documents.id"))
  chunk_text = Column(Text, nullable=False)
  chunk_index = Column(Integer)
  embedding = Column(Vector(1536))
  document = relationship("Document", back_populates="chunks")


class Conversation(Base):
  __tablename__ = "conversations"
  id = Column(Integer, primary_key=True)
  user_id = Column(Integer, ForeignKey("users.id"))
  title = Column(String)
  created_at = Column(DateTime, server_default=func.now())
  messages = relationship("Message", back_populates="conversation")


class Message(Base):
  __tablename__ = "messages"
  id = Column(Integer, primary_key=True)
  conversation_id = Column(Integer, ForeignKey("conversations.id"))
  role = Column(String)
  content = Column(Text)
  created_at = Column(DateTime, server_default=func.now())
  sources = relationship("MessageSource", back_populates="message")
  conversation= relationship("Conversation", back_populates="messages")

class MessageSource(Base):
  __tablename__ = "message_sources"
  id = Column(Integer, primary_key=True)
  message_id = Column(Integer, ForeignKey("messages.id"))
  chunk_id = Column(Integer, ForeignKey("document_chunks.id"))
  relevance_score = Column(Float)
  message = relationship("Message", back_populates="sources")