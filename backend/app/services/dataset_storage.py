import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from ..schemas import DatasetMetadata

APP_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = APP_DIR.parent
DATASETS_DIR = BACKEND_DIR / "data" / "datasets"
METADATA_DIR = BACKEND_DIR / "data" / "metadata"


def _ensure_storage_dirs() -> None:
    DATASETS_DIR.mkdir(parents=True, exist_ok=True)
    METADATA_DIR.mkdir(parents=True, exist_ok=True)


def save_dataset(upload: UploadFile) -> DatasetMetadata:
    _ensure_storage_dirs()

    original_filename = Path(upload.filename or "uploaded_file").name
    dataset_id = uuid4().hex
    extension = Path(original_filename).suffix
    stored_filename = f"{dataset_id}{extension}"
    dataset_path = DATASETS_DIR / stored_filename

    with dataset_path.open("wb") as destination:
        shutil.copyfileobj(upload.file, destination)

    metadata = DatasetMetadata(
        id=dataset_id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        size_bytes=dataset_path.stat().st_size,
        uploaded_at=datetime.now(timezone.utc).isoformat(),
    )

    metadata_path = METADATA_DIR / f"{dataset_id}.json"
    with metadata_path.open("w", encoding="utf-8") as metadata_file:
        json.dump(metadata.model_dump(), metadata_file, indent=2)

    return metadata


def list_datasets() -> list[DatasetMetadata]:
    _ensure_storage_dirs()
    datasets: list[DatasetMetadata] = []

    for metadata_path in METADATA_DIR.glob("*.json"):
        with metadata_path.open("r", encoding="utf-8") as metadata_file:
            raw = json.load(metadata_file)

        try:
            datasets.append(DatasetMetadata(**raw))
        except Exception:
            continue

    datasets.sort(key=lambda item: item.uploaded_at, reverse=True)
    return datasets
