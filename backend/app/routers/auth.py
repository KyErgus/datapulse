from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import authenticate_user, create_access_token, get_current_user, hash_password
from ..database import get_db
from ..models import User
from ..schemas import LoginRequest, RegisterRequest, TokenResponse
from ..serializers import serialize_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = (
        db.query(User)
        .filter((User.username == payload.username) | (User.email == payload.email))
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Username or email already exists")

    user = User(
        username=payload.username.strip(),
        email=payload.email.strip().lower(),
        password_hash=hash_password(payload.password),
        profile_description=(payload.profile_description or "").strip(),
        api_key=uuid4().hex,
        created_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.id), username=user.username)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": serialize_user(user),
    }


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(payload.username.strip(), payload.password, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(subject=str(user.id), username=user.username)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": serialize_user(user),
    }


@router.get("/me")
def auth_me(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)
