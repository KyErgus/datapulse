from fastapi import FastAPI, UploadFile, File, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .database import SessionLocal, engine
from . import models
from . import storage
from .auth import get_current_user

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="DataPulse API")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/datasets/upload")
def upload_dataset(
    file: UploadFile = File(...),
    name: str | None = None,
    description: str | None = None,
    tags: str | None = None,
    dataset_type: str | None = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    return storage.save_dataset(
        file,
        db,
        owner_id=user.id,
        name=name,
        description=description,
        tags=tags,
        dataset_type=dataset_type
    )


@app.get("/datasets")
def list_datasets(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):

    datasets = db.query(models.Dataset).filter(models.Dataset.owner_id == user.id)

    if search:
        datasets = datasets.filter(models.Dataset.filename.ilike(f"%{search}%"))

    return datasets.all()


@app.get("/datasets/explore")
def explore_datasets(
    search: str | None = Query(default=None),
    limit: int = 20,
    db: Session = Depends(get_db)
):

    query = db.query(models.Dataset)

    if search:
        query = query.filter(models.Dataset.name.ilike(f"%{search}%"))

    return (
        query
        .order_by(models.Dataset.download_count.desc())
        .limit(limit)
        .all()
    )


@app.get("/marketplace")
def marketplace(db: Session = Depends(get_db)):

    return (
        db.query(models.Dataset)
        .order_by(models.Dataset.download_count.desc())
        .limit(50)
        .all()
    )


@app.get("/datasets/{dataset_id}")
def get_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):

    dataset = (
        db.query(models.Dataset)
        .filter(models.Dataset.id == dataset_id)
        .filter(models.Dataset.owner_id == user.id)
        .first()
    )

    if not dataset:
        return {"error": "Dataset not found"}

    return dataset


@app.get("/datasets/{dataset_id}/preview")
def preview_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):

    dataset = (
        db.query(models.Dataset)
        .filter(models.Dataset.id == dataset_id)
        .filter(models.Dataset.owner_id == user.id)
        .first()
    )

    if not dataset:
        return {"error": "Dataset not found"}

    return storage.preview_dataset(dataset)


@app.get("/datasets/{dataset_id}/download")
def download_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):

    dataset = (
        db.query(models.Dataset)
        .filter(models.Dataset.id == dataset_id)
        .first()
    )

    if not dataset:
        return {"error": "Dataset not found"}

    dataset.download_count += 1
    db.commit()

    return FileResponse(dataset.filepath, filename=dataset.filename)


@app.delete("/datasets/{dataset_id}")
def delete_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):

    dataset = (
        db.query(models.Dataset)
        .filter(models.Dataset.id == dataset_id)
        .filter(models.Dataset.owner_id == user.id)
        .first()
    )

    if not dataset:
        return {"error": "Dataset not found"}

    return storage.delete_dataset(dataset_id, db)


@app.get("/public/dataset/{public_id}")
def public_dataset(public_id: str, db: Session = Depends(get_db)):

    dataset = db.query(models.Dataset).filter(models.Dataset.public_id == public_id).first()

    if not dataset:
        return {"error": "Dataset not found"}

    return {
        "name": dataset.name,
        "filename": dataset.filename,
        "version": dataset.version,
        "download_url": f"/datasets/{dataset.id}/download"
    }
@app.get("/datasets/{dataset_id}/analytics")
def dataset_analytics(
    dataset_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):

    dataset = (
        db.query(models.Dataset)
        .filter(models.Dataset.id == dataset_id)
        .filter(models.Dataset.owner_id == user.id)
        .first()
    )

    if not dataset:
        return {"error": "Dataset not found"}

    return storage.dataset_analytics(dataset)
@app.get("/public/dataset/{public_id}/preview")
def public_dataset_preview(public_id: str, db: Session = Depends(get_db)):

    dataset = db.query(models.Dataset).filter(models.Dataset.public_id == public_id).first()

    if not dataset:
        return {"error": "Dataset not found"}

    return storage.preview_dataset(dataset)
@app.get("/public/dataset/{public_id}/analytics")
def public_dataset_analytics(public_id: str, db: Session = Depends(get_db)):

    dataset = db.query(models.Dataset).filter(models.Dataset.public_id == public_id).first()

    if not dataset:
        return {"error": "Dataset not found"}

    return storage.dataset_analytics(dataset)
