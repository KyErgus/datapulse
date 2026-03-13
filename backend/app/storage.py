from __future__ import annotations

from .shelby_storage import upload_to_shelby

import shutil
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy.orm import Session

from .models import Dataset

BASE_DIR = Path(__file__).resolve().parent.parent
DATASETS_DIR = BASE_DIR / "data" / "datasets"

DATASETS_DIR.mkdir(parents=True, exist_ok=True)


def save_dataset(upload: UploadFile, db: Session):
    if not upload.filename:
        raise ValueError("Uploaded file must have a filename.")

    dataset_id = uuid4().hex
    original_filename = Path(upload.filename).name
    extension = Path(original_filename).suffix
    stored_filename = f"{dataset_id}{extension}" if extension else dataset_id

    dataset_path = DATASETS_DIR / stored_filename

    # Save file locally
    with dataset_path.open("wb") as destination:
        shutil.copyfileobj(upload.file, destination)

    # Upload to Shelby (optional decentralized storage)
    try:
        shelby_result = upload_to_shelby(dataset_path)
        shelby_url = shelby_result.get("url")
    except Exception:
        shelby_url = None

    dataset = Dataset(
        filename=original_filename,
        filepath=str(dataset_path),
        size=dataset_path.stat().st_size,
        created_at=datetime.utcnow(),
    )

    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    return dataset


def list_datasets(db: Session):
    return db.query(Dataset).order_by(Dataset.created_at.desc()).all()
