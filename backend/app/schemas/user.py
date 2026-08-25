from pydantic import BaseModel, ConfigDict, EmailStr


class UserRegister(BaseModel):
  email: EmailStr
  password: str

class UserLogin(BaseModel):
  email: EmailStr
  password: str

class UserResponse(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  id: int
  email: str

class TokenResponse(BaseModel):
  access_token: str
  token_type: str = "bearer"

