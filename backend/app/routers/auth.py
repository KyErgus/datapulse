from datetime import datetime, timedelta
import re
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from uuid import uuid4

import requests
from requests import RequestException
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..auth import (
    X_OAUTH_CLIENT_ID,
    X_OAUTH_CLIENT_SECRET,
    X_OAUTH_ERROR_REDIRECT,
    X_OAUTH_REDIRECT_URI,
    X_OAUTH_SCOPE,
    X_OAUTH_STATE_TTL_SECONDS,
    X_OAUTH_SUCCESS_REDIRECT,
    X_OAUTH_TOKEN_URL,
    X_OAUTH_USERINFO_URL,
    authenticate_user,
    build_x_authorization_url,
    create_access_token,
    create_oauth_state,
    create_pkce_code_challenge,
    create_pkce_code_verifier,
    get_current_user,
    hash_password,
    x_oauth_is_configured,
)
from ..database import get_db
from ..models import OAuthState, User
from ..schemas import LoginRequest, RegisterRequest, TokenResponse, WalletLoginRequest
from ..serializers import serialize_user

router = APIRouter(prefix="/auth", tags=["auth"])
APTOS_ADDRESS_PATTERN = re.compile(r"^0x[a-fA-F0-9]{1,64}$")


def _append_query(url: str, values: dict[str, str]) -> str:
    parsed = urlparse(url)
    query_values = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query_values.update(values)
    return urlunparse(parsed._replace(query=urlencode(query_values)))


def _extract_error_detail(response: requests.Response, fallback: str) -> str:
    try:
        payload = response.json()
        if isinstance(payload, dict):
            for key in ("error_description", "detail", "error", "message"):
                value = payload.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
    except ValueError:
        pass

    text = (response.text or "").strip()
    if text:
        return text[:180]
    return fallback


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


@router.post("/wallet-login", response_model=TokenResponse)
def wallet_login(payload: WalletLoginRequest, db: Session = Depends(get_db)):
    provider = payload.provider.strip().lower()
    address = payload.address.strip().lower()

    if not provider:
        raise HTTPException(status_code=400, detail="provider is required")
    if not address:
        raise HTTPException(status_code=400, detail="address is required")
    if not APTOS_ADDRESS_PATTERN.match(address):
        raise HTTPException(status_code=400, detail="Invalid Aptos wallet address format")

    user = db.query(User).filter(User.aptos_wallet_address == address).first()
    if not user:
        username_base = f"{provider}_{address[-8:]}"
        candidate_username = username_base
        suffix = 1
        while db.query(User).filter(User.username == candidate_username).first():
            suffix += 1
            candidate_username = f"{username_base}_{suffix}"

        candidate_email = f"{candidate_username}@wallet.datapulse.local"
        email_suffix = 1
        while db.query(User).filter(User.email == candidate_email).first():
            email_suffix += 1
            candidate_email = f"{candidate_username}_{email_suffix}@wallet.datapulse.local"

        user = User(
            username=candidate_username,
            email=candidate_email,
            password_hash=None,
            profile_description="Wallet account",
            api_key=uuid4().hex,
            aptos_wallet_provider=provider,
            aptos_wallet_address=address,
            aptos_connected_at=datetime.utcnow(),
            created_at=datetime.utcnow(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.aptos_wallet_provider = provider
        user.aptos_connected_at = datetime.utcnow()
        db.commit()
        db.refresh(user)

    token = create_access_token(subject=str(user.id), username=user.username)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": serialize_user(user),
    }


@router.get("/me")
def auth_me(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


@router.get("/x/start")
def x_oauth_start(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not x_oauth_is_configured():
        raise HTTPException(
            status_code=503,
            detail="X OAuth is not configured on server. Set X_OAUTH_CLIENT_ID and X_OAUTH_REDIRECT_URI.",
        )

    db.query(OAuthState).filter(OAuthState.expires_at < datetime.utcnow()).delete()

    state = create_oauth_state()
    code_verifier = create_pkce_code_verifier()
    code_challenge = create_pkce_code_challenge(code_verifier)
    expires_at = datetime.utcnow() + timedelta(seconds=X_OAUTH_STATE_TTL_SECONDS)

    record = OAuthState(
        provider="x",
        state=state,
        code_verifier=code_verifier,
        user_id=current_user.id,
        created_at=datetime.utcnow(),
        expires_at=expires_at,
    )
    db.add(record)
    db.commit()

    authorization_url = build_x_authorization_url(state=state, code_challenge=code_challenge)
    return {
        "authorization_url": authorization_url,
        "state": state,
        "provider": "x",
        "scope": X_OAUTH_SCOPE,
        "expires_at": expires_at.isoformat(),
    }


@router.get("/x/callback")
def x_oauth_callback(
    state: str = Query(default=""),
    code: str = Query(default=""),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    def _error_redirect(message: str):
        return RedirectResponse(
            _append_query(
                X_OAUTH_ERROR_REDIRECT,
                {"reason": message},
            )
        )

    if error:
        return _error_redirect(error_description or error)

    if not x_oauth_is_configured():
        return _error_redirect("x_oauth_not_configured")
    if not state:
        return _error_redirect("missing_state")

    oauth_state = (
        db.query(OAuthState)
        .filter(
            OAuthState.provider == "x",
            OAuthState.state == state,
        )
        .first()
    )
    if not oauth_state or oauth_state.expires_at < datetime.utcnow():
        return _error_redirect("invalid_or_expired_state")

    if not code:
        return _error_redirect("missing_code")

    user = db.query(User).filter(User.id == oauth_state.user_id).first()
    if not user:
        db.delete(oauth_state)
        db.commit()
        return _error_redirect("user_not_found")

    try:
        token_payload = {
            "code": code,
            "grant_type": "authorization_code",
            "client_id": X_OAUTH_CLIENT_ID,
            "redirect_uri": X_OAUTH_REDIRECT_URI,
            "code_verifier": oauth_state.code_verifier,
        }

        request_kwargs: dict = {
            "data": token_payload,
            "headers": {"Accept": "application/json"},
            "timeout": 20,
        }
        if X_OAUTH_CLIENT_SECRET:
            request_kwargs["auth"] = (X_OAUTH_CLIENT_ID, X_OAUTH_CLIENT_SECRET)

        token_response = requests.post(X_OAUTH_TOKEN_URL, **request_kwargs)
        if token_response.status_code >= 400:
            raise ValueError(_extract_error_detail(token_response, "token_exchange_failed"))

        token_json = token_response.json() if token_response.content else {}

        access_token = token_json.get("access_token")
        if not access_token:
            raise ValueError("missing_access_token")

        user_response = requests.get(
            X_OAUTH_USERINFO_URL,
            params={"user.fields": "profile_image_url,description,location,url"},
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=20,
        )
        if user_response.status_code >= 400:
            raise ValueError(_extract_error_detail(user_response, "x_user_fetch_failed"))

        user_json = user_response.json() if user_response.content else {}

        x_data = user_json.get("data") or {}
        x_username = (x_data.get("username") or "").strip()
        x_user_id = (x_data.get("id") or "").strip()
        if not x_username:
            raise ValueError("missing_x_username")

        conflict = (
            db.query(User)
            .filter(User.x_username == x_username, User.id != user.id)
            .first()
        )
        if conflict:
            raise ValueError("x_account_already_linked")

        user.x_username = x_username
        user.x_user_id = x_user_id or None
        user.x_profile_url = f"https://x.com/{x_username}"
        user.x_avatar_url = (x_data.get("profile_image_url") or "").strip() or None
        user.x_connected_at = datetime.utcnow()

        if not user.full_name and x_data.get("name"):
            user.full_name = x_data.get("name")
        if x_data.get("profile_image_url"):
            user.avatar_url = x_data.get("profile_image_url")
        if not user.profile_description and x_data.get("description"):
            user.profile_description = x_data.get("description")
        if not user.location and x_data.get("location"):
            user.location = x_data.get("location")
        if not user.website and x_data.get("url"):
            user.website = x_data.get("url")

        db.delete(oauth_state)
        db.commit()
    except RequestException:
        db.rollback()
        return _error_redirect("x_network_error")
    except Exception as exc:
        db.rollback()
        return _error_redirect(str(exc) or "x_oauth_callback_failed")

    success_url = _append_query(
        X_OAUTH_SUCCESS_REDIRECT,
        {"x_username": user.x_username or ""},
    )
    return RedirectResponse(success_url)
