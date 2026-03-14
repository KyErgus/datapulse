from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from ..auth import get_optional_user
from ..database import get_db
from ..models import Dataset, User
from ..serializers import serialize_dataset

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


def _base_marketplace_query(db: Session):
    return db.query(Dataset).filter(Dataset.visibility.in_(["marketplace", "public"]))


@router.get("")
def marketplace(
    sort: str = Query(default="downloads"),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    query = _base_marketplace_query(db)

    sort_key = sort.lower()
    if sort_key in {"new", "newest"}:
        query = query.order_by(desc(Dataset.created_at))
    elif sort_key in {"price", "price_low", "price_asc"}:
        query = query.order_by(Dataset.price.asc())
    elif sort_key in {"price_high", "price_desc"}:
        query = query.order_by(Dataset.price.desc())
    elif sort_key == "trending":
        age_days = (func.extract("epoch", func.now() - Dataset.created_at) / 86400.0)
        score = (Dataset.download_count + 1) / (age_days + 1)
        query = query.order_by(desc(score))
    else:
        query = query.order_by(desc(Dataset.download_count), desc(Dataset.created_at))

    datasets = query.limit(limit).all()
    return [
        serialize_dataset(
            dataset,
            owner_username=dataset.owner.username if dataset.owner else None,
        )
        for dataset in datasets
    ]
