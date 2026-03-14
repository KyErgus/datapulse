from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import User


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):

    if authorization is None:
        raise HTTPException(status_code=401, detail="Missing API key")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth header")

    token = authorization.replace("Bearer ", "")

    user = db.query(User).filter(User.api_key == token).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid API key")

    return user
