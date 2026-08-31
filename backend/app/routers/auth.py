"""
app/routers/auth.py

Authentication endpoints supporting two client types:

1. Web app (Next.js) — uses httpOnly cookies via /auth/login
   Cookie is invisible to JavaScript, protecting against XSS token theft.

2. Chrome extension — uses Bearer tokens via /auth/login/token
   Extensions run on a chrome-extension:// origin and can't reliably use
   cross-origin cookies, so they receive the raw JWT and store it in
   chrome.storage.local instead.

Both endpoints issue the same JWT — only the delivery mechanism differs.
The get_current_user dependency accepts either, checking cookie first.
"""

from datetime import timedelta, datetime, timezone

import jwt
from pwdlib import PasswordHash
from app.dependencies.deps import get_current_user
from app.models.tables import User
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from app.database import get_db
import app.schemas.user as schemas
import logging
from app.config import SECRET_KEY, ALGORITHM, EXPIRE_MIN, IS_PRODUCTION


logger = logging.getLogger(__name__)

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
    logger.warning(f"Registration attempt with existing email: {user.email}")
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
  new_user = User(
    email = user.email,
    hashed_password = hash_password(user.password)
  )

  db.add(new_user)
  db.commit()
  db.refresh(new_user)
  logger.info(f"New user registered: {new_user.email}")
  return new_user

@router.post('/login', response_model=schemas.MessageResponse)
def login(data: schemas.UserLogin, response: Response, db: Session = Depends(get_db)):
  """
    Web app login — sets an httpOnly cookie containing the JWT.

    The token is NOT returned in the response body. This is deliberate:
    if JavaScript never sees the token, an XSS attack cannot steal it.

    Cookie flags:
        httponly=True        JavaScript cannot read this cookie (XSS protection)
        secure=IS_PRODUCTION HTTPS-only in production; disabled locally
                             because localhost runs on HTTP
        samesite="lax"       Blocks the cookie on cross-site fetch requests
                             (CSRF protection) while still allowing normal
                             link navigation
        max_age              Matches the JWT expiry so the cookie dies with the token
  """
  existing_user = db.query(User).filter(User.email == data.username).first()

  if not existing_user or not verify_password(
    data.password,
    existing_user.hashed_password
  ):
    logger.warning(f"Failed login attempt for: {data.username}")
    raise HTTPException(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="Invalid Credentials"
    )

  token = create_access_token(existing_user.email, existing_user.id)
  logger.info(f"User logged in: {data.username}")
  response.set_cookie(
    key="access_token",
    value=token,
    httponly=True,
    secure=IS_PRODUCTION,
    samesite="lax",
    max_age=EXPIRE_MIN*60,
    path="/"
  )

  return {"message": "Logged in successfully"}

@router.post("/login/token", response_model=schemas.TokenResponse)
def login_token(data: schemas.UserLogin, db: Session = Depends(get_db)):
  """
    Chrome extension login — returns the raw JWT in the response body.

    Extensions run on a chrome-extension:// origin, which the browser treats
    as cross-site relative to this API. Cookies set with samesite="lax" are
    not sent from that origin, so the extension needs the token directly.

    The extension stores this in chrome.storage.local, which is isolated
    per-extension and not readable by websites or other extensions.

    Sends the token on subsequent requests as:
        Authorization: Bearer <access_token>
  """

  existing_user = db.query(User).filter(User.email == data.username).first()
  if not existing_user or not verify_password(data.password, existing_user.hashed_password):
    raise HTTPException(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="Invalid Credentials"
    )

  token = create_access_token(existing_user.email, existing_user.id)

  return {
    'access_token': token,
    'token_type': 'bearer'
  }

@router.post("/logout", response_model=schemas.MessageResponse)
def logout(response: Response):
  """
  Clears the auth cookie (web app only).

    Cookie flags must match those used when setting it, otherwise
    the browser won't recognize which cookie to delete.

    Extensions log out by clearing their own chrome.storage.local —
    no server call needed, since the server holds no session state.
  """
  response.delete_cookie(
    key="access_token",
    httponly=True,
    secure=IS_PRODUCTION,
    samesite="lax",
    path="/"
  )

  return {"message": "Logged out successfully"}


@router.get("/me", response_model=schemas.UserResponse)
def me(current_user: User = Depends(get_current_user)):
  """
    Returns the currently authenticated user.

    Works with either auth method — get_current_user checks the cookie
    first, then falls back to the Authorization header.

    The web app calls this on load to verify a stored cookie is still valid,
    since httpOnly cookies can't be inspected from JavaScript.
    """
  return current_user




