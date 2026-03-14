import shutil
from datetime import datetime
from pathlib import Path
from uuid import uuid4

import pandas as pd
from fastapi import UploadFile
from sqlalchemy.orm import Session

from .models import Dataset


BASE_DIR = Path(__file__).resolve().parent.parent
DATASETS_DIR = BASE_DIR / "data" / "datasets"

DATASETS_DIR.mkdir(parents=True, exist_ok=True)


def save_dataset(
    upload: UploadFile,
    db: Session,
    owner_id: int | None,
    name: str | None = None,
    description: str | None = None,
    tags: str | None = None,
    dataset_type: str | None = None,
    category: str | None = None,
    price: float | None = None,
    is_paid: bool | None = None,
    license_name: str | None = None,
    visibility: str | None = None,
):
    if not upload.filename:
        raise ValueError("Uploaded file must have a filename.")

    original_filename = Path(upload.filename).name
    extension = Path(original_filename).suffix
    stored_filename = f"{uuid4().hex}{extension}" if extension else uuid4().hex
    dataset_path = DATASETS_DIR / stored_filename

    with dataset_path.open("wb") as destination:
        shutil.copyfileobj(upload.file, destination)

    resolved_price = 0.0 if price is None else float(price)
    resolved_is_paid = bool(is_paid) if is_paid is not None else resolved_price > 0
    resolved_visibility = (visibility or "public").lower()
    if resolved_visibility not in {"public", "private", "marketplace"}:
        resolved_visibility = "public"

    dataset = Dataset(
        owner_id=owner_id,
        public_id=uuid4().hex,
        filename=original_filename,
        filepath=str(dataset_path),
        size=dataset_path.stat().st_size,
        name=name or original_filename,
        description=description,
        tags=tags,
        dataset_type=dataset_type,
        category=category,
        price=max(0.0, resolved_price),
        is_paid=resolved_is_paid,
        license=license_name or "CC-BY-4.0",
        visibility=resolved_visibility,
        created_at=datetime.utcnow(),
    )

    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    return dataset


def delete_dataset(dataset_id: int, db: Session):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()

    if not dataset:
        return {"error": "Dataset not found"}

    path = Path(dataset.filepath)
    if path.exists():
        path.unlink()

    db.delete(dataset)
    db.commit()

    return {"message": "Dataset deleted"}


def increment_download(dataset: Dataset, db: Session):
    dataset.download_count = (dataset.download_count or 0) + 1
    db.commit()


def preview_dataset(dataset: Dataset, rows: int = 10):
    path = dataset.filepath

    if path.endswith(".csv"):
        df = pd.read_csv(path)
        return {
            "columns": list(df.columns),
            "preview": df.head(rows).to_dict(orient="records"),
        }

    if path.endswith(".json"):
        df = pd.read_json(path)
        return {
            "columns": list(df.columns),
            "preview": df.head(rows).to_dict(orient="records"),
        }

    return {"error": "Preview not supported for this file type"}


def dataset_analytics(dataset: Dataset):
    path = dataset.filepath

    if path.endswith(".csv"):
        df = pd.read_csv(path)
    elif path.endswith(".json"):
        df = pd.read_json(path)
    else:
        return {"error": "Unsupported file type"}

    return {
        "rows": len(df),
        "columns": list(df.columns),
        "column_types": df.dtypes.astype(str).to_dict(),
        "missing_values": df.isnull().sum().to_dict(),
        "numeric_stats": df.describe().to_dict(),
    }
