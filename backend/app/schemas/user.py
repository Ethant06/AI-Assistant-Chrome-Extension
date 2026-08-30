from pydantic import BaseModel, ConfigDict, EmailStr


class UserRegister(BaseModel):
  """
  Input schema for POST /auth/register

  EmailStr type valides format (ensures contains @ and a valid domain)
  Password is stored as a pwdlib hash - never stored or returned as plaintext
  """
  email: EmailStr
  password: str


class UserLogin(BaseModel):
  """
  Input schema for POST /auth/login
  """
  email: EmailStr
  password: str

class UserResponse(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  id: int
  email: str


class TokenResponse(BaseModel):
  """
  Output schema for POST /auth/login

  access_token is a signed JWT - store client-side (localStorage or httpOnly coookie)
  and used in authrorization body on every protected request.


  """

  access_token: str
  token_type: str = "bearer"

