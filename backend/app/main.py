from fastapi import FastAPI

from .database import ensure_schema
from .routers import auth as auth_router
from .routers import datasets as datasets_router
from .routers import marketplace as marketplace_router
from .routers import users as users_router

ensure_schema()

app = FastAPI(
    title="DataPulse Backend",
    version="1.0.0",
    description="DataPulse full data platform API",
)

app.include_router(auth_router.router)
app.include_router(datasets_router.router)
app.include_router(marketplace_router.router)
app.include_router(users_router.router)


@app.get("/health")
def health():
    return {"status": "ok"}
