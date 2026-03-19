import base64
from datetime import datetime, timedelta, timezone
import hashlib
import os
import secrets
from urllib.parse import urlencode

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from .database import get_db
from .models import User

load_dotenv()


SECRET_KEY = os.getenv("DATAPULSE_JWT_SECRET", "datapulse-dev-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

X_OAUTH_AUTHORIZE_URL = os.getenv(
    "X_OAUTH_AUTHORIZE_URL",
    "https://twitter.com/i/oauth2/authorize",
)
X_OAUTH_TOKEN_URL = os.getenv(
    "X_OAUTH_TOKEN_URL",
    "https://api.twitter.com/2/oauth2/token",
)
X_OAUTH_USERINFO_URL = os.getenv(
    "X_OAUTH_USERINFO_URL",
    "https://api.twitter.com/2/users/me",
)
X_OAUTH_CLIENT_ID = os.getenv("X_OAUTH_CLIENT_ID", "")
X_OAUTH_CLIENT_SECRET = os.getenv("X_OAUTH_CLIENT_SECRET", "")
X_OAUTH_REDIRECT_URI = os.getenv("X_OAUTH_REDIRECT_URI", "")
X_OAUTH_SCOPE = os.getenv(
    "X_OAUTH_SCOPE",
    "tweet.read users.read offline.access",
)
X_OAUTH_STATE_TTL_SECONDS = int(os.getenv("X_OAUTH_STATE_TTL_SECONDS", "900"))
X_OAUTH_SUCCESS_REDIRECT = os.getenv(
    "X_OAUTH_SUCCESS_REDIRECT",
    "http://localhost:5173/profile?x=connected",
)
X_OAUTH_ERROR_REDIRECT = os.getenv(
    "X_OAUTH_ERROR_REDIRECT",
    "http://localhost:5173/profile?x=error",
)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False

    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(
    subject: str,
    username: str,
    expires_delta: timedelta | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload = {
        "sub": subject,
        "username": username,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _resolve_user_from_token(token: str, db: Session) -> User | None:
    # Preferred: JWT token.
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        subject = payload.get("sub")
        if subject:
            return db.query(User).filter(User.id == int(subject)).first()
    except Exception:
        # Backward compatibility: legacy api_key token.
        return db.query(User).filter(User.api_key == token).first()

    return None


def _extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None

    if not authorization.startswith("Bearer "):
        return None

    return authorization.replace("Bearer ", "", 1).strip()


def get_optional_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    token = _extract_bearer_token(authorization)
    if not token:
        return None

    return _resolve_user_from_token(token, db)


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    token = _extract_bearer_token(authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token",
        )

    user = _resolve_user_from_token(token, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    return user


def authenticate_user(username: str, password: str, db: Session) -> User | None:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user


def x_oauth_is_configured() -> bool:
    return bool(X_OAUTH_CLIENT_ID and X_OAUTH_REDIRECT_URI)


def create_pkce_code_verifier() -> str:
    return secrets.token_urlsafe(64)


def create_pkce_code_challenge(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


def create_oauth_state() -> str:
    return secrets.token_urlsafe(32)


def build_x_authorization_url(state: str, code_challenge: str) -> str:
    query = urlencode(
        {
            "response_type": "code",
            "client_id": X_OAUTH_CLIENT_ID,
            "redirect_uri": X_OAUTH_REDIRECT_URI,
            "scope": X_OAUTH_SCOPE,
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
    )
    return f"{X_OAUTH_AUTHORIZE_URL}?{query}"
