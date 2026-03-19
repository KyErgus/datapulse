from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=6, max_length=128)
    profile_description: str | None = ""


class LoginRequest(BaseModel):
    username: str
    password: str


class WalletLoginRequest(BaseModel):
    provider: str
    address: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict
