from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

from .storage import list_datasets, save_dataset

app = FastAPI(title="DataPulse API", version="0.1.0")


class Dataset(BaseModel):
    id: str
    original_filename: str
    stored_filename: str
    size_bytes: int
    uploaded_at: str


class DatasetListResponse(BaseModel):
    datasets: list[Dataset]
    count: int


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/datasets/upload", response_model=Dataset)
def upload_dataset(file: UploadFile = File(...)) -> Dataset:
    try:
        saved = save_dataset(file)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return Dataset.model_validate(saved)


@app.get("/datasets", response_model=DatasetListResponse)
def get_datasets() -> DatasetListResponse:
    datasets = list_datasets()
    return DatasetListResponse(datasets=[Dataset.model_validate(item) for item in datasets], count=len(datasets))
