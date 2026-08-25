from pathlib import Path
from fastapi import Depends, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from app.database import get_db
from sqlalchemy.orm import Session
from app.models.tables import User
import jwt
from jwt import PyJWTError
from dotenv import load_dotenv
import os

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

SECRET_KEY = os.getenv("AUTH_SECRET_KEY")
ALGORITHM =- os.getenv("AUTH_ALGORITHM")

oauth2_bearer = OAuth2PasswordBearer(tokenUrl='/auth/login')

def get_current_user(token: str = Depends(oauth2_bearer), db: Session = Depends(get_db)):
  credential_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired token"
  )
  try:
    payload = jwt.decode(
      token,
      SECRET_KEY,
      algorithm=ALGORITHM
    )
    if not payload:
      raise credential_exception
  except PyJWTError:
    raise credential_exception

  user = db.query(User).filter(User.email == payload.get('sub')).first()
  if user is None:
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
  return user # User object