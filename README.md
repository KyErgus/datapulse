# DataPulse Backend

Initial FastAPI backend for DataPulse with dataset upload and dataset listing.

## Project Structure

```text
.
├── backend
│   ├── app
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── routers
│   │   │   ├── __init__.py
│   │   │   └── datasets.py
│   │   ├── schemas.py
│   │   └── services
│   │       ├── __init__.py
│   │       └── dataset_storage.py
│   ├── data
│   │   ├── datasets
│   │   │   └── .gitkeep
│   │   └── metadata
│   │       └── .gitkeep
│   └── requirements.txt
├── requirements.txt
└── README.md
```

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn backend.app.main:app --reload
```

API docs: `http://127.0.0.1:8000/docs`

## Endpoints

- `GET /health`
- `POST /datasets/upload`
- `GET /datasets`

## Examples

Upload a dataset:

```bash
curl -X POST "http://127.0.0.1:8000/datasets/upload" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/dataset.csv"
```

List datasets:

```bash
curl "http://127.0.0.1:8000/datasets"
```
