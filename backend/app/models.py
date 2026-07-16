from sqlalchemy import Column, Integer, Float, String, DateTime
from sqlalchemy.sql import func

from .database import Base


class Reading(Base):
    __tablename__ = "readings"

    id = Column(Integer, primary_key=True, index=True)
    measured_at = Column(DateTime, nullable=False, index=True)
    location = Column(String, nullable=False, index=True)  # "atrium" | "outside"
    temperature = Column(Float, nullable=False)
    brightness = Column(String, nullable=True)
    noise = Column(String, nullable=True)


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    category = Column(String, nullable=False)
    comment = Column(String, nullable=True)
    status = Column(String, nullable=False, default="open")
