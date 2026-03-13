from fastapi import FastAPI, UploadFile, File, Depends
from sqlalchemy.orm import Session

from .database import SessionLocal
from . import storage

app = FastAPI()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post("/datasets/upload")
def upload_dataset(file: UploadFile = File(...), db: Session = Depends(get_db)):
    return storage.save_dataset(file, db)


@app.get("/datasets")
def get_datasets(db: Session = Depends(get_db)):
    return storage.list_datasets(db)
