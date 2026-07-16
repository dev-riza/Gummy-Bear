"""Imports backend/data/result.json into the readings table (idempotent)."""
import json
import os

from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine
from .models import Reading
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


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        inserted = seed_if_empty(db)
        print(f"Inserted {inserted} readings from {DATA_FILE}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
