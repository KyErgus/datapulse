# DataPulse Backend

Initial backend scaffold for DataPulse using FastAPI.

## Project Structure

```text
.
├── backend
│   ├── app
│   │   ├── __init__.py
│   │   ├── main.py
│   │   └── storage.py
│   └── data
│       ├── datasets
│       │   └── .gitkeep
│       └── metadata
│           └── .gitkeep
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

- `POST /datasets/upload`: Upload a dataset file.
- `GET /datasets`: List uploaded datasets.
- `GET /health`: Simple health check.

### Upload Example

```bash
curl -X POST "http://127.0.0.1:8000/datasets/upload" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/dataset.csv"
```

### List Example

```bash
curl "http://127.0.0.1:8000/datasets"
```
