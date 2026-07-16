from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Event
from ..schemas import EventOut

router = APIRouter(prefix="/api/events", tags=["events"])

# How far ahead of an event's start to begin showing an advance-notice banner.
ADVANCE_NOTICE_MINUTES = 60


@router.get("/active", response_model=Optional[EventOut])
def get_active_event(db: Session = Depends(get_db)):
    """Returns the event happening right now, or the soonest upcoming one
    within the advance-notice window — whichever is more relevant. None if
    there's nothing going on. Read-only: events are added directly to the
    database, not through this API.
    """
    now = datetime.now()
    notice_cutoff = now + timedelta(minutes=ADVANCE_NOTICE_MINUTES)

    event = (
        db.query(Event)
        .filter(Event.start_time <= notice_cutoff, Event.end_time >= now)
        .order_by(Event.start_time)
        .first()
    )

    if event is None:
        return None

    status = "ongoing" if event.start_time <= now else "upcoming"
    return EventOut(
        id=event.id,
        title=event.title,
        start_time=event.start_time,
        end_time=event.end_time,
        status=status,
    )
