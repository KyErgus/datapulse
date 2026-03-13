from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from .database import Base

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    filepath = Column(String)
    size = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
