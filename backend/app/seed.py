"""Imports backend/data/result.json into the readings table (idempotent)."""
import json
import os
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine
from .models import Event, Reading
from .parser import parse_export

DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "result.json")


def seed_if_empty(db: Session) -> int:
    if db.query(Reading).count() > 0:
        return 0

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        export = json.load(f)

    readings = parse_export(export)
    db.bulk_save_objects([Reading(**r) for r in readings])
    db.commit()
    return len(readings)


def seed_events_if_empty(db: Session) -> int:
    """One demo event, live relative to whenever the app first starts, so the
    Home page banner has something to show immediately. Add real events
    directly to the `events` table afterward (e.g. with DB Browser for
    SQLite) — there's no API for creating them."""
    if db.query(Event).count() > 0:
        return 0

    now = datetime.now()
    db.add(
        Event(
            title="День открытых дверей NU",
            start_time=now - timedelta(minutes=15),
            end_time=now + timedelta(hours=2),
        )
    )
    db.commit()
    return 1


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        inserted = seed_if_empty(db)
        print(f"Inserted {inserted} readings from {DATA_FILE}")
        inserted_events = seed_events_if_empty(db)
        print(f"Inserted {inserted_events} demo event(s)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
