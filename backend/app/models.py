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


class Event(Base):
    """Atrium events. Read-only from the API — rows are added directly to the
    database (e.g. with DB Browser for SQLite), not through the app."""

    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=False)


class Preference(Base):
    """One row per anonymous visitor (identified by a browser-generated
    visitor_id, no login involved). Used to personalize comfort_score to
    that visitor's own idea of ideal conditions."""

    __tablename__ = "preferences"

    id = Column(Integer, primary_key=True, index=True)
    visitor_id = Column(String, unique=True, nullable=False, index=True)
    preferred_temp = Column(Float, nullable=False)
    preferred_noise = Column(String, nullable=False)
    preferred_brightness = Column(String, nullable=False)
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
