from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Dataset, Purchase, User
from ..serializers import serialize_dataset, serialize_user
from ..storage import dataset_analytics, preview_dataset

router = APIRouter(tags=["users"])


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
        "profile_description": user.profile_description or "",
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
