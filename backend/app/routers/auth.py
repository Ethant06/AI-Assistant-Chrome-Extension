from datetime import timedelta, datetime, timezone

import jwt
from pwdlib import PasswordHash
from app.models.tables import User
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
import app.schemas.user as schemas
import logging
from app.config import SECRET_KEY, ALGORITHM, EXPIRE_MIN

router = APIRouter(
  prefix = '/auth',
  tags = ['auth']
)

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
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
  existing_user = db.query(User).filter(User.email == form_data.username).first()

  if not existing_user or not verify_password(
    form_data.password,
    existing_user.hashed_password
  ):
    raise HTTPException(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="Invalid Credentials",
      headers={"WWW-Authenticate": "Bearer"},
    )

  token = create_access_token(existing_user.email, existing_user.id)

  return {
    'access_token': token,
    'token_type': 'bearer'
  }

