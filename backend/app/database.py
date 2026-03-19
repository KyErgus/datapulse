import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://datapulse_user:datapulse_password@localhost/datapulse",
)

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_column(conn, inspector, table_name: str, column_name: str, definition: str):
    columns = {column["name"] for column in inspector.get_columns(table_name)}
    if column_name not in columns:
        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"))


def ensure_schema():
    # Create newly introduced tables.
    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        inspector = inspect(conn)
        tables = set(inspector.get_table_names())

        if "users" in tables:
            _ensure_column(conn, inspector, "users", "email", "VARCHAR")
            _ensure_column(conn, inspector, "users", "password_hash", "VARCHAR")
            _ensure_column(
                conn,
                inspector,
                "users",
                "profile_description",
                "TEXT DEFAULT ''",
            )
            conn.execute(
                text("UPDATE users SET profile_description = '' WHERE profile_description IS NULL")
            )
            _ensure_column(conn, inspector, "users", "full_name", "VARCHAR")
            _ensure_column(conn, inspector, "users", "avatar_url", "VARCHAR")
            _ensure_column(conn, inspector, "users", "location", "VARCHAR")
            _ensure_column(conn, inspector, "users", "website", "VARCHAR")
            _ensure_column(conn, inspector, "users", "x_username", "VARCHAR")
            _ensure_column(conn, inspector, "users", "x_user_id", "VARCHAR")
            _ensure_column(conn, inspector, "users", "x_profile_url", "VARCHAR")
            _ensure_column(conn, inspector, "users", "x_avatar_url", "VARCHAR")
            _ensure_column(conn, inspector, "users", "x_connected_at", "TIMESTAMP")
            _ensure_column(conn, inspector, "users", "aptos_wallet_address", "VARCHAR")
            _ensure_column(conn, inspector, "users", "aptos_wallet_provider", "VARCHAR")
            _ensure_column(conn, inspector, "users", "aptos_connected_at", "TIMESTAMP")

        if "datasets" in tables:
            _ensure_column(conn, inspector, "datasets", "price", "DOUBLE PRECISION DEFAULT 0")
            _ensure_column(conn, inspector, "datasets", "is_paid", "BOOLEAN DEFAULT FALSE")
            _ensure_column(
                conn,
                inspector,
                "datasets",
                "license",
                "VARCHAR DEFAULT 'CC-BY-4.0'",
            )
            _ensure_column(
                conn,
                inspector,
                "datasets",
                "visibility",
                "VARCHAR DEFAULT 'public'",
            )
            _ensure_column(conn, inspector, "datasets", "category", "VARCHAR")
            _ensure_column(conn, inspector, "datasets", "preview_image", "VARCHAR")

            conn.execute(text("UPDATE datasets SET price = 0 WHERE price IS NULL"))
            conn.execute(text("UPDATE datasets SET is_paid = FALSE WHERE is_paid IS NULL"))
            conn.execute(
                text(
                    "UPDATE datasets SET license = 'CC-BY-4.0' "
                    "WHERE license IS NULL OR license = ''"
                )
            )
            conn.execute(
                text(
                    "UPDATE datasets SET visibility = 'public' "
                    "WHERE visibility IS NULL OR visibility = ''"
                )
            )
