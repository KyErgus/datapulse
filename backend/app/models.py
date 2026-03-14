from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    api_key = Column(String, unique=True, index=True)
    profile_description = Column(Text, default="", nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    datasets = relationship("Dataset", back_populates="owner")
    purchases = relationship("Purchase", back_populates="buyer")


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)

    owner_id = Column(Integer, ForeignKey("users.id"), index=True)

    public_id = Column(String, unique=True, index=True, nullable=False)

    filename = Column(String)
    filepath = Column(String)

    size = Column(Integer)

    name = Column(String)
    description = Column(String)
    tags = Column(String)
    dataset_type = Column(String)
    category = Column(String)
    preview_image = Column(String)

    price = Column(Float, default=0.0, nullable=False)
    is_paid = Column(Boolean, default=False, nullable=False)
    license = Column(String, default="CC-BY-4.0", nullable=False)
    visibility = Column(String, default="public", nullable=False)

    version = Column(Integer, default=1)

    download_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="datasets")
    purchases = relationship("Purchase", back_populates="dataset")


class Purchase(Base):
    __tablename__ = "purchases"
    __table_args__ = (UniqueConstraint("buyer_id", "dataset_id", name="uq_buyer_dataset"),)

    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, index=True)
    amount = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    buyer = relationship("User", back_populates="purchases")
    dataset = relationship("Dataset", back_populates="purchases")
