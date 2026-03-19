from datetime import datetime, timezone

from .models import Dataset, Purchase, User


def _iso(value):
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    return value


def serialize_user(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "profile_description": user.profile_description or "",
        "full_name": user.full_name or "",
        "avatar_url": user.avatar_url or "",
        "location": user.location or "",
        "website": user.website or "",
        "x_username": user.x_username or "",
        "x_user_id": user.x_user_id or "",
        "x_profile_url": user.x_profile_url or "",
        "x_avatar_url": user.x_avatar_url or "",
        "x_connected_at": _iso(user.x_connected_at),
        "aptos_wallet_address": user.aptos_wallet_address or "",
        "aptos_wallet_provider": user.aptos_wallet_provider or "",
        "aptos_connected_at": _iso(user.aptos_connected_at),
        "created_at": _iso(user.created_at),
    }


def serialize_dataset(
    dataset: Dataset,
    owner_username: str | None = None,
    can_download: bool | None = None,
    is_owner: bool | None = None,
    is_purchased: bool | None = None,
):
    payload = {
        "id": dataset.id,
        "owner_id": dataset.owner_id,
        "public_id": dataset.public_id,
        "filename": dataset.filename,
        "filepath": dataset.filepath,
        "size": dataset.size,
        "name": dataset.name,
        "description": dataset.description,
        "tags": dataset.tags,
        "dataset_type": dataset.dataset_type,
        "category": dataset.category,
        "preview_image": dataset.preview_image,
        "version": dataset.version,
        "download_count": dataset.download_count,
        "created_at": _iso(dataset.created_at),
        "price": float(dataset.price or 0.0),
        "is_paid": bool(dataset.is_paid),
        "license": dataset.license,
        "visibility": dataset.visibility,
    }

    if owner_username:
        payload["owner_username"] = owner_username
    if can_download is not None:
        payload["can_download"] = can_download
    if is_owner is not None:
        payload["is_owner"] = is_owner
    if is_purchased is not None:
        payload["is_purchased"] = is_purchased

    return payload


def serialize_purchase(purchase: Purchase):
    return {
        "id": purchase.id,
        "buyer_id": purchase.buyer_id,
        "dataset_id": purchase.dataset_id,
        "amount": float(purchase.amount or 0.0),
        "created_at": _iso(purchase.created_at),
    }
