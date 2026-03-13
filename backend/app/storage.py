from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import UploadFile

BASE_DIR = Path(__file__).resolve().parent.parent
DATASETS_DIR = BASE_DIR / "data" / "datasets"
METADATA_DIR = BASE_DIR / "data" / "metadata"

DATASETS_DIR.mkdir(parents=True, exist_ok=True)
METADATA_DIR.mkdir(parents=True, exist_ok=True)


def save_dataset(upload: UploadFile) -> dict[str, Any]:
    if not upload.filename:
        raise ValueError("Uploaded file must have a filename.")

    dataset_id = uuid4().hex
    original_filename = Path(upload.filename).name
    extension = Path(original_filename).suffix
    stored_filename = f"{dataset_id}{extension}" if extension else dataset_id

    dataset_path = DATASETS_DIR / stored_filename
    with dataset_path.open("wb") as destination:
        shutil.copyfileobj(upload.file, destination)

    metadata = {
        "id": dataset_id,
        "original_filename": original_filename,
        "stored_filename": stored_filename,
        "size_bytes": dataset_path.stat().st_size,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }

    metadata_path = METADATA_DIR / f"{dataset_id}.json"
    with metadata_path.open("w", encoding="utf-8") as metadata_file:
        json.dump(metadata, metadata_file, indent=2)

    return metadata


def list_datasets() -> list[dict[str, Any]]:
    datasets: list[dict[str, Any]] = []

    for metadata_path in METADATA_DIR.glob("*.json"):
        with metadata_path.open("r", encoding="utf-8") as metadata_file:
            dataset = json.load(metadata_file)
            datasets.append(dataset)

    datasets.sort(key=lambda item: item["uploaded_at"], reverse=True)
    return datasets
