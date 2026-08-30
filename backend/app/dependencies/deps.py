from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.database import get_db
from sqlalchemy.orm import Session
from app.models.tables import User
import jwt
from jwt import PyJWTError
import logging
from app.config import SECRET_KEY, ALGORITHM

logger = logging.getLogger(__name__)

# Tells FastAPI to extract the Bearer token from the Authorization header.
# tokenUrl points to the login endpoint
oauth2_bearer = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(
  token: str = Depends(oauth2_bearer),
  db: Session = Depends(get_db),
):

  """
  FastAPI dependency that authenticates the current user from their JWT token.
  Used on every protected endpoint via Depends(get_current_user). This returns a User object if valid, raises 401 if not.
  """

   # reusable 401 exception — raised for any auth failure
  # WWW-Authenticate header tells the client what auth scheme is expected
  credential_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired token",
    headers={"WWW-Authenticate": "Bearer"},
  )
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