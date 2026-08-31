"""
app/dependencies/deps.py

Authentication dependency used by every protected endpoint.

Supports two token delivery mechanisms:
    1. httpOnly cookie      — web app (preferred, XSS-resistant)
    2. Authorization header — Chrome extension (cookies unavailable cross-origin)

Cookie is checked first since it's the more secure path.
"""

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from app.database import get_db
from sqlalchemy.orm import Session
from app.models.tables import User
import jwt
from jwt import PyJWTError
import logging
from app.config import SECRET_KEY, ALGORITHM

logger = logging.getLogger(__name__)

def get_current_user(
  request: Request,
  db: Session = Depends(get_db),
):

  """
    Authenticates the current user from their JWT.

    Token resolution order:
        1. access_token cookie (set by /auth/login for the web app)
        2. Authorization: Bearer header (used by the Chrome extension)

    Raises 401 if no valid token is found, the signature is invalid,
    the token is expired, or the user no longer exists.
  """

  # reusable 401 exception — raised for any auth failure
  # WWW-Authenticate header tells the client what auth scheme is expected
  credential_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired token",
    headers={"WWW-Authenticate": "Bearer"},
  )

  # 1. Try the httpOnly cookie (web app)
  token = request.cookies.get("access_token")

  # 2. Fall back to authorization header (chrome extension)
  if not token:
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
      token = auth_header[7:]

  if not token:
    raise credential_exception

  try:
    payload = jwt.decode(
      token,
      SECRET_KEY,
      algorithms=[ALGORITHM],
    )
  except PyJWTError:
    raise credential_exception

  email = payload.get("sub")
  if not email:
    logger.warning("Invalid or expired token attempt")
    raise credential_exception

  user = db.query(User).filter(User.email == email).first()
  if user is None:
    raise HTTPException(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="User not found",
      headers={"WWW-Authenticate": "Bearer"},
    )
  return user