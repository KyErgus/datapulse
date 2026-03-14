from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import and_, asc, desc, func, or_
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_optional_user
from ..database import get_db
from ..models import Dataset, Purchase, User
from ..serializers import serialize_dataset, serialize_purchase
from ..storage import (
    dataset_analytics,
    delete_dataset,
    increment_download,
    preview_dataset,
    save_dataset,
)

router = APIRouter(prefix="/datasets", tags=["datasets"])


def _get_or_create_guest_user(db: Session) -> User:
    guest = db.query(User).filter(User.username == "guest").first()
    if guest:
        return guest

    guest = User(
        username="guest",
        email="guest@datapulse.local",
        profile_description="Guest uploads",
        api_key=uuid4().hex,
    )
    db.add(guest)
    db.commit()
    db.refresh(guest)
    return guest


def _get_dataset_with_owner(db: Session, dataset_id: int) -> Dataset | None:
    return (
        db.query(Dataset)
        .filter(Dataset.id == dataset_id)
        .first()
    )


def _is_owner(dataset: Dataset, user: User | None) -> bool:
    return bool(user and dataset.owner_id == user.id)


def _can_access_dataset(dataset: Dataset, user: User | None) -> bool:
    if dataset.visibility != "private":
        return True

    return _is_owner(dataset, user)


def _has_purchase(dataset_id: int, user_id: int, db: Session) -> bool:
    purchase = (
        db.query(Purchase)
        .filter(Purchase.dataset_id == dataset_id, Purchase.buyer_id == user_id)
        .first()
    )
    return purchase is not None


def _can_download_dataset(dataset: Dataset, user: User | None, db: Session) -> bool:
    if _is_owner(dataset, user):
        return True

    if not dataset.is_paid:
        return True

    if not user:
        return False

    return _has_purchase(dataset.id, user.id, db)


def _serialize_dataset_with_user(dataset: Dataset, user: User | None, db: Session):
    owner_username = dataset.owner.username if dataset.owner else None
    purchased = _has_purchase(dataset.id, user.id, db) if user else False
    return serialize_dataset(
        dataset,
        owner_username=owner_username,
        can_download=_can_download_dataset(dataset, user, db),
        is_owner=_is_owner(dataset, user),
        is_purchased=purchased,
    )


@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    name: str | None = Form(default=None),
    description: str | None = Form(default=None),
    tags: str | None = Form(default=None),
    dataset_type: str | None = Form(default=None),
    category: str | None = Form(default=None),
    price: float | None = Form(default=None),
    is_paid: bool | None = Form(default=None),
    license: str | None = Form(default=None),
    visibility: str | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file must have a filename.")

    owner = current_user or _get_or_create_guest_user(db)

    try:
        dataset = save_dataset(
            upload=file,
            db=db,
            owner_id=owner.id,
            name=name,
            description=description,
            tags=tags,
            dataset_type=dataset_type,
            category=category,
            price=price,
            is_paid=is_paid,
            license_name=license,
            visibility=visibility,
        )
    finally:
        await file.close()

    db.refresh(dataset)
    return _serialize_dataset_with_user(dataset, current_user, db)


@router.get("")
def list_datasets(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    query = db.query(Dataset)

    if current_user:
        query = query.filter(or_(Dataset.visibility != "private", Dataset.owner_id == current_user.id))
    else:
        query = query.filter(Dataset.visibility != "private")

    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(Dataset.filename.ilike(like), Dataset.name.ilike(like), Dataset.description.ilike(like))
        )

    datasets = query.order_by(desc(Dataset.created_at)).all()
    return [_serialize_dataset_with_user(dataset, current_user, db) for dataset in datasets]


@router.get("/explore")
def explore_datasets(
    search: str | None = Query(default=None),
    tags: str | None = Query(default=None),
    price_min: float | None = Query(default=None),
    price_max: float | None = Query(default=None),
    sort: str | None = Query(default="downloads"),
    limit: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    query = db.query(Dataset)

    if current_user:
        query = query.filter(or_(Dataset.visibility != "private", Dataset.owner_id == current_user.id))
    else:
        query = query.filter(Dataset.visibility != "private")

    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(Dataset.name.ilike(like), Dataset.filename.ilike(like), Dataset.description.ilike(like))
        )

    if tags:
        tags_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
        for tag in tags_list:
            query = query.filter(Dataset.tags.ilike(f"%{tag}%"))

    if price_min is not None:
        query = query.filter(Dataset.price >= price_min)
    if price_max is not None:
        query = query.filter(Dataset.price <= price_max)

    sort_key = (sort or "downloads").lower()
    if sort_key in {"new", "newest"}:
        query = query.order_by(desc(Dataset.created_at))
    elif sort_key in {"price", "price_low", "price_asc"}:
        query = query.order_by(asc(Dataset.price))
    elif sort_key in {"price_high", "price_desc"}:
        query = query.order_by(desc(Dataset.price))
    elif sort_key == "trending":
        age_days = (
            func.extract("epoch", func.now() - Dataset.created_at) / 86400.0
        )
        trending_score = (Dataset.download_count + 1) / (age_days + 1)
        query = query.order_by(desc(trending_score))
    else:
        query = query.order_by(desc(Dataset.download_count), desc(Dataset.created_at))

    datasets = query.limit(limit).all()
    return [_serialize_dataset_with_user(dataset, current_user, db) for dataset in datasets]


@router.get("/{dataset_id}")
def get_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    dataset = _get_dataset_with_owner(db, dataset_id)
    if not dataset or not _can_access_dataset(dataset, current_user):
        return {"error": "Dataset not found"}

    return _serialize_dataset_with_user(dataset, current_user, db)


@router.patch("/{dataset_id}")
def update_dataset(
    dataset_id: int,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dataset = _get_dataset_with_owner(db, dataset_id)
    if not dataset:
        return {"error": "Dataset not found"}

    if not _is_owner(dataset, current_user):
        raise HTTPException(status_code=403, detail="Only owner can update dataset")

    allowed_fields = {
        "name",
        "description",
        "tags",
        "dataset_type",
        "category",
        "price",
        "is_paid",
        "license",
        "visibility",
        "preview_image",
    }

    for field, value in payload.items():
        if field not in allowed_fields:
            continue

        if field == "visibility" and value not in {"public", "private", "marketplace"}:
            continue

        if field == "price":
            value = max(0.0, float(value))

        setattr(dataset, field, value)

    db.commit()
    db.refresh(dataset)
    return _serialize_dataset_with_user(dataset, current_user, db)


@router.get("/{dataset_id}/preview")
def dataset_preview(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    dataset = _get_dataset_with_owner(db, dataset_id)
    if not dataset or not _can_access_dataset(dataset, current_user):
        return {"error": "Dataset not found"}

    return preview_dataset(dataset)


@router.get("/{dataset_id}/analytics")
def dataset_analytics_view(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    dataset = _get_dataset_with_owner(db, dataset_id)
    if not dataset or not _can_access_dataset(dataset, current_user):
        return {"error": "Dataset not found"}

    return dataset_analytics(dataset)


@router.post("/{dataset_id}/purchase")
def purchase_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dataset = _get_dataset_with_owner(db, dataset_id)
    if not dataset:
        return {"error": "Dataset not found"}

    if _is_owner(dataset, current_user):
        return {"message": "Owner already has access"}

    if not dataset.is_paid:
        return {"message": "Dataset is free", "amount": 0}

    existing = (
        db.query(Purchase)
        .filter(Purchase.dataset_id == dataset.id, Purchase.buyer_id == current_user.id)
        .first()
    )
    if existing:
        return {"message": "Already purchased", "purchase": serialize_purchase(existing)}

    purchase = Purchase(
        buyer_id=current_user.id,
        dataset_id=dataset.id,
        amount=float(dataset.price or 0.0),
        created_at=datetime.utcnow(),
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)

    return {"message": "Purchase successful", "purchase": serialize_purchase(purchase)}


@router.get("/{dataset_id}/download")
def download_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    dataset = _get_dataset_with_owner(db, dataset_id)
    if not dataset or not _can_access_dataset(dataset, current_user):
        return {"error": "Dataset not found"}

    if not _can_download_dataset(dataset, current_user, db):
        raise HTTPException(status_code=402, detail="Dataset requires purchase")

    increment_download(dataset, db)
    return FileResponse(dataset.filepath, filename=dataset.filename)


@router.delete("/{dataset_id}")
def remove_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    dataset = _get_dataset_with_owner(db, dataset_id)
    if not dataset:
        return {"error": "Dataset not found"}

    if current_user is None:
        owner = dataset.owner
        if not owner or owner.username != "guest":
            raise HTTPException(status_code=401, detail="Authentication required")
    elif not _is_owner(dataset, current_user):
        raise HTTPException(status_code=403, detail="Only owner can delete dataset")

    return delete_dataset(dataset_id, db)
