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
    owner_id: int,
    name: str | None = None,
    description: str | None = None,
    tags: str | None = None,
    dataset_type: str | None = None
):

    if not upload.filename:
        raise ValueError("Uploaded file must have a filename.")

    dataset_id = uuid4().hex

    original_filename = Path(upload.filename).name
    extension = Path(original_filename).suffix

    stored_filename = f"{dataset_id}{extension}" if extension else dataset_id

    dataset_path = DATASETS_DIR / stored_filename

    with dataset_path.open("wb") as destination:
        shutil.copyfileobj(upload.file, destination)

    dataset = Dataset(
        owner_id=owner_id,
        public_id=uuid4().hex,
        filename=original_filename,
        filepath=str(dataset_path),
        size=dataset_path.stat().st_size,
        name=name,
        description=description,
        tags=tags,
        dataset_type=dataset_type,
        created_at=datetime.utcnow()
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


def increment_download(dataset, db: Session):

    dataset.download_count += 1
    db.commit()


def preview_dataset(dataset, rows=10):

    path = dataset.filepath

    if path.endswith(".csv"):

        df = pd.read_csv(path)

        return {
            "columns": list(df.columns),
            "preview": df.head(rows).to_dict(orient="records")
        }

    if path.endswith(".json"):

        df = pd.read_json(path)

        return {
            "columns": list(df.columns),
            "preview": df.head(rows).to_dict(orient="records")
        }

    return {
        "error": "Preview not supported for this file type"
    }
def dataset_analytics(dataset):

    import pandas as pd

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
        "numeric_stats": df.describe().to_dict()
    }
