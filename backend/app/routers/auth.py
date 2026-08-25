from datetime import timedelta, datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
import jwt, os
from pwdlib import PasswordHash
from app.models.tables import User
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
import app.schemas.user as schemas
import logging


load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

router = APIRouter(
  prefix = '/auth',
  tags = ['auth']
)

SECRET_KEY = os.getenv("AUTH_SECRET_KEY")
ALGORITHM = os.getenv("AUTH_ALGORITHM")
EXPIRE_MIN = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
password_hash = PasswordHash.recommended()

def hash_password(password: str) -> str:
  return password_hash.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
  return password_hash.verify(plain_password, hashed_password)

def create_access_token(username: str, user_id: int) -> str:
  data_encode = {'sub': username, 'id': user_id}
  expire = datetime.now(timezone.utc) + timedelta(minutes=EXPIRE_MIN)
  data_encode.update({'exp': expire})
  return jwt.encode(data_encode, SECRET_KEY, algorithm=ALGORITHM)

@router.post('/register', response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: schemas.UserRegister, db: Session = Depends(get_db)):
  existing_user = db.query(User).filter(User.email == user.email).first()
  if existing_user:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
  new_user = User(
    email = user.email,
    hashed_password = hash_password(user.password)
  )

  db.add(new_user)
  db.commit()
  db.refresh(new_user)
  return new_user

@router.post('/login', response_model=schemas.TokenResponse)
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
  existing_user = db.query(User).filter(user.email == User.email).first()

  if not existing_user or not verify_password(
    user.password,
    existing_user.hashed_password
  ):
    raise HTTPException(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="Invalid Credentials"
    )

  token = create_access_token(existing_user.email, existing_user.id)

  return {
    'access_token': token,
    'token_type': 'bearer'
  }

