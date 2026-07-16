import csv
import io
from datetime import date as date_type, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from .. import analytics
from ..database import get_db
from ..models import Reading
from ..schemas import CurrentState, PaginatedReadings, ReadingOut, ReadingWithStatus

router = APIRouter(prefix="/api", tags=["readings"])


def _to_status(reading: Reading) -> ReadingWithStatus:
    is_atrium = reading.location == "atrium"
    return ReadingWithStatus(
        id=reading.id,
        measured_at=reading.measured_at,
        location=reading.location,
        temperature=reading.temperature,
        brightness=reading.brightness,
        noise=reading.noise,
        temperature_status=analytics.temperature_status(reading.temperature) if is_atrium else None,
        noise_status=analytics.noise_status(reading.noise) if is_atrium else None,
        brightness_status=analytics.brightness_status(reading.brightness) if is_atrium else None,
        comfort_score=(
            analytics.comfort_score(reading.temperature, reading.noise, reading.brightness)
            if is_atrium
            else None
        ),
    )


def _apply_filters(
    query,
    date: Optional[date_type],
    location: Optional[str],
    noise: Optional[str],
    brightness: Optional[str],
    temp_min: Optional[float],
    temp_max: Optional[float],
):
    if date is not None:
        start = datetime.combine(date, datetime.min.time())
        end = start + timedelta(days=1)
        query = query.filter(Reading.measured_at >= start, Reading.measured_at < end)
    if location is not None:
        query = query.filter(Reading.location == location)
    if noise is not None:
        query = query.filter(Reading.noise == noise)
    if brightness is not None:
        query = query.filter(Reading.brightness == brightness)
    if temp_min is not None:
        query = query.filter(Reading.temperature >= temp_min)
    if temp_max is not None:
        query = query.filter(Reading.temperature <= temp_max)
    return query


@router.get("/readings", response_model=PaginatedReadings)
def list_readings(
    date: Optional[date_type] = None,
    location: Optional[str] = Query(default=None, pattern="^(atrium|outside)$"),
    noise: Optional[str] = None,
    brightness: Optional[str] = None,
    temp_min: Optional[float] = None,
    temp_max: Optional[float] = None,
    sort_by: str = Query(default="measured_at", pattern="^(measured_at|temperature)$"),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(Reading)
    query = _apply_filters(query, date, location, noise, brightness, temp_min, temp_max)

    total = query.count()

    sort_column = Reading.measured_at if sort_by == "measured_at" else Reading.temperature
    query = query.order_by(asc(sort_column) if order == "asc" else desc(sort_column))
    query = query.offset((page - 1) * page_size).limit(page_size)

    items = [_to_status(r) for r in query.all()]
    return PaginatedReadings(items=items, total=total, page=page, page_size=page_size)


@router.get("/readings/export")
def export_readings_csv(
    date: Optional[date_type] = None,
    location: Optional[str] = Query(default=None, pattern="^(atrium|outside)$"),
    noise: Optional[str] = None,
    brightness: Optional[str] = None,
    temp_min: Optional[float] = None,
    temp_max: Optional[float] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Reading)
    query = _apply_filters(query, date, location, noise, brightness, temp_min, temp_max)
    query = query.order_by(asc(Reading.measured_at))

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["id", "measured_at", "location", "temperature", "brightness", "noise", "comfort_score"])
    for r in query.all():
        score = (
            analytics.comfort_score(r.temperature, r.noise, r.brightness)
            if r.location == "atrium"
            else ""
        )
        writer.writerow([r.id, r.measured_at.isoformat(), r.location, r.temperature, r.brightness or "", r.noise or "", score])

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=readings.csv"},
    )


@router.get("/readings/{reading_id}", response_model=ReadingWithStatus)
def get_reading(reading_id: int, db: Session = Depends(get_db)):
    reading = db.get(Reading, reading_id)
    if reading is None:
        raise HTTPException(status_code=404, detail="Reading not found")
    return _to_status(reading)


@router.get("/current", response_model=CurrentState)
def get_current_state(db: Session = Depends(get_db)):
    latest_atrium = (
        db.query(Reading).filter(Reading.location == "atrium").order_by(desc(Reading.measured_at)).first()
    )
    latest_outside = (
        db.query(Reading).filter(Reading.location == "outside").order_by(desc(Reading.measured_at)).first()
    )

    if latest_atrium is None and latest_outside is None:
        raise HTTPException(status_code=404, detail="No readings available yet")

    diff = None
    if latest_atrium is not None and latest_outside is not None:
        diff = round(latest_atrium.temperature - latest_outside.temperature, 1)

    if latest_atrium is not None:
        overall_status = analytics.temperature_status(latest_atrium.temperature)
        recommendation = analytics.study_recommendation(latest_atrium.temperature, latest_atrium.noise)
    else:
        overall_status = "Нет данных по атриуму"
        recommendation = "Недостаточно данных"

    return CurrentState(
        atrium=_to_status(latest_atrium) if latest_atrium else None,
        outside=ReadingOut.model_validate(latest_outside) if latest_outside else None,
        indoor_outdoor_diff=diff,
        overall_status=overall_status,
        recommendation=recommendation,
    )
