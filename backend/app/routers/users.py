from datetime import datetime
import re

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Dataset, Purchase, User
from ..serializers import serialize_dataset, serialize_user
from ..storage import dataset_analytics, preview_dataset

router = APIRouter(tags=["users"])
APTOS_ADDRESS_PATTERN = re.compile(r"^0x[a-fA-F0-9]{1,64}$")


@router.get("/me/datasets")
def my_datasets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    datasets = (
        db.query(Dataset)
        .filter(Dataset.owner_id == current_user.id)
        .order_by(Dataset.created_at.desc())
        .all()
    )
    return [serialize_dataset(dataset, owner_username=current_user.username) for dataset in datasets]


@router.get("/me/profile")
def my_profile(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


@router.patch("/me/profile")
def update_my_profile(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed = {
        "full_name",
        "profile_description",
        "avatar_url",
        "location",
        "website",
    }

    for key, value in payload.items():
        if key not in allowed:
            continue
        setattr(current_user, key, (value or "").strip() if isinstance(value, str) else value)

    db.commit()
    db.refresh(current_user)
    return serialize_user(current_user)


@router.post("/me/connect-x")
def connect_x_account(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    x_username = (payload.get("x_username") or "").strip().lstrip("@")
    x_user_id = (payload.get("x_user_id") or "").strip()
    x_profile_url = (payload.get("x_profile_url") or "").strip()
    avatar_url = (payload.get("avatar_url") or "").strip()

    if not x_username:
        raise HTTPException(status_code=400, detail="x_username is required")

    existing = (
        db.query(User)
        .filter(User.x_username == x_username, User.id != current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="This X username is already linked")

    current_user.x_username = x_username
    current_user.x_user_id = x_user_id or None
    current_user.x_profile_url = x_profile_url or f"https://x.com/{x_username}"
    current_user.x_avatar_url = avatar_url or None
    current_user.x_connected_at = datetime.utcnow()

    # Optional convenience update from the same form.
    if avatar_url:
        current_user.avatar_url = avatar_url

    db.commit()
    db.refresh(current_user)
    return serialize_user(current_user)


@router.delete("/me/connect-x")
def disconnect_x_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.x_username = None
    current_user.x_user_id = None
    current_user.x_profile_url = None
    current_user.x_avatar_url = None
    current_user.x_connected_at = None
    db.commit()
    db.refresh(current_user)
    return {"message": "X account disconnected", "user": serialize_user(current_user)}


@router.post("/me/connect-wallet")
def connect_aptos_wallet(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    provider = (payload.get("provider") or "").strip().lower()
    address = (payload.get("address") or "").strip()

    if not provider:
        raise HTTPException(status_code=400, detail="provider is required")
    if not address:
        raise HTTPException(status_code=400, detail="address is required")

    normalized_address = address.lower()
    if not APTOS_ADDRESS_PATTERN.match(normalized_address):
        raise HTTPException(status_code=400, detail="Invalid Aptos wallet address format")

    conflict = (
        db.query(User)
        .filter(User.aptos_wallet_address == normalized_address, User.id != current_user.id)
        .first()
    )
    if conflict:
        raise HTTPException(status_code=409, detail="This Aptos wallet is already linked")

    current_user.aptos_wallet_provider = provider
    current_user.aptos_wallet_address = normalized_address
    current_user.aptos_connected_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    return serialize_user(current_user)


@router.delete("/me/connect-wallet")
def disconnect_aptos_wallet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.aptos_wallet_provider = None
    current_user.aptos_wallet_address = None
    current_user.aptos_connected_at = None
    db.commit()
    db.refresh(current_user)
    return {"message": "Aptos wallet disconnected", "user": serialize_user(current_user)}


@router.get("/me/stats")
def my_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owned_datasets = db.query(Dataset).filter(Dataset.owner_id == current_user.id).all()
    dataset_ids = [dataset.id for dataset in owned_datasets]

    total_downloads = sum(dataset.download_count or 0 for dataset in owned_datasets)
    total_revenue = 0.0

    if dataset_ids:
        revenue = (
            db.query(func.coalesce(func.sum(Purchase.amount), 0.0))
            .filter(Purchase.dataset_id.in_(dataset_ids))
            .scalar()
        )
        total_revenue = float(revenue or 0.0)

    return {
        "total_datasets": len(owned_datasets),
        "total_downloads": total_downloads,
        "total_revenue": total_revenue,
    }


@router.get("/users/{username}")
def public_user_profile(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    datasets = (
        db.query(Dataset)
        .filter(Dataset.owner_id == user.id, Dataset.visibility != "private")
        .order_by(Dataset.created_at.desc())
        .all()
    )
    total_downloads = sum(dataset.download_count or 0 for dataset in datasets)

    return {
        "username": user.username,
        "full_name": user.full_name or "",
        "avatar_url": user.avatar_url or "",
        "profile_description": user.profile_description or "",
        "x_username": user.x_username or "",
        "x_profile_url": user.x_profile_url or "",
        "x_avatar_url": user.x_avatar_url or "",
        "total_downloads": total_downloads,
        "datasets": [serialize_dataset(dataset, owner_username=user.username) for dataset in datasets],
    }


@router.get("/public/dataset/{public_id}")
def public_dataset(public_id: str, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.public_id == public_id).first()

    if not dataset:
        return {"error": "Dataset not found"}

    return {
        "name": dataset.name,
        "filename": dataset.filename,
        "version": dataset.version,
        "download_url": f"/datasets/{dataset.id}/download",
    }


@router.get("/public/dataset/{public_id}/preview")
def public_dataset_preview(public_id: str, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.public_id == public_id).first()

    if not dataset:
        return {"error": "Dataset not found"}

    return preview_dataset(dataset)


@router.get("/public/dataset/{public_id}/analytics")
def public_dataset_analytics(public_id: str, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.public_id == public_id).first()

    if not dataset:
        return {"error": "Dataset not found"}

    return dataset_analytics(dataset)
