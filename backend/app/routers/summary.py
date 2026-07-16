from datetime import date as date_type, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import analytics
from ..database import get_db
from ..models import Reading
from ..schemas import DailyStat, Insight, SummaryOut

router = APIRouter(prefix="/api", tags=["summary"])


def _day_bounds(day: date_type):
    start = datetime.combine(day, datetime.min.time())
    return start, start + timedelta(days=1)


@router.get("/summary/available-dates")
def available_dates(db: Session = Depends(get_db)):
    rows = db.query(func.date(Reading.measured_at)).distinct().order_by(func.date(Reading.measured_at)).all()
    return [r[0] for r in rows]


@router.get("/summary", response_model=SummaryOut)
def get_summary(date: Optional[date_type] = None, db: Session = Depends(get_db)):
    if date is None:
        latest = db.query(func.max(Reading.measured_at)).scalar()
        if latest is None:
            raise HTTPException(status_code=404, detail="No readings available yet")
        date = latest.date()

    start, end = _day_bounds(date)

    atrium_readings = (
        db.query(Reading)
        .filter(Reading.location == "atrium", Reading.measured_at >= start, Reading.measured_at < end)
        .order_by(Reading.measured_at)
        .all()
    )
    outside_readings = (
        db.query(Reading)
        .filter(Reading.location == "outside", Reading.measured_at >= start, Reading.measured_at < end)
        .order_by(Reading.measured_at)
        .all()
    )

    if not atrium_readings and not outside_readings:
        raise HTTPException(status_code=404, detail=f"No readings found for {date.isoformat()}")

    def stat(values: list[float]) -> DailyStat:
        if not values:
            return DailyStat(count=0)
        return DailyStat(
            min=round(min(values), 1),
            max=round(max(values), 1),
            avg=round(sum(values) / len(values), 1),
            count=len(values),
        )

    atrium_temps = [r.temperature for r in atrium_readings]
    outside_temps = [r.temperature for r in outside_readings]

    atrium_stat = stat(atrium_temps)
    outside_stat = stat(outside_temps)

    indoor_outdoor_diff = None
    if atrium_stat.avg is not None and outside_stat.avg is not None:
        indoor_outdoor_diff = round(atrium_stat.avg - outside_stat.avg, 1)

    scores = [
        analytics.comfort_score(r.temperature, r.noise, r.brightness) for r in atrium_readings
    ]
    avg_score = round(sum(scores) / len(scores)) if scores else None
    uncomfortable_count = sum(1 for s in scores if s < 60)

    insights: list[Insight] = []

    if atrium_readings:
        coolest = min(atrium_readings, key=lambda r: r.temperature)
        insights.append(
            Insight(
                label="Самое прохладное время",
                value=coolest.measured_at.strftime("%H:%M"),
                detail=f"{coolest.temperature:.1f}°C в атриуме",
            )
        )

        hottest = max(atrium_readings, key=lambda r: r.temperature)
        insights.append(
            Insight(
                label="Самый жаркий период",
                value=hottest.measured_at.strftime("%H:%M"),
                detail=f"{hottest.temperature:.1f}°C в атриуме",
            )
        )

        noise_rank = {"Quiet": 0, "Mild noise": 1, "Noisy": 2, "Very noisy": 3, None: 2}
        quietest = min(atrium_readings, key=lambda r: noise_rank.get(r.noise, 2))
        insights.append(
            Insight(
                label="Самое тихое время",
                value=quietest.measured_at.strftime("%H:%M"),
                detail=analytics.noise_status(quietest.noise) or "Нет данных",
            )
        )

        best = max(
            atrium_readings,
            key=lambda r: analytics.comfort_score(r.temperature, r.noise, r.brightness),
        )
        insights.append(
            Insight(
                label="Лучший период для учёбы",
                value=best.measured_at.strftime("%H:%M"),
                detail=f"comfort score {analytics.comfort_score(best.temperature, best.noise, best.brightness)}/100",
            )
        )

    insights.append(
        Insight(
            label="Некомфортных измерений",
            value=str(uncomfortable_count),
            detail=f"из {len(atrium_readings)} измерений в атриуме за день",
        )
    )

    if indoor_outdoor_diff is not None:
        insights.append(
            Insight(
                label="Разница внутри/снаружи",
                value=f"{indoor_outdoor_diff:+.1f}°C",
                detail="средняя температура в атриуме минус средняя на улице",
            )
        )

    return SummaryOut(
        date=date.isoformat(),
        atrium_temperature=atrium_stat,
        outside_temperature=outside_stat,
        indoor_outdoor_avg_diff=indoor_outdoor_diff,
        uncomfortable_readings=uncomfortable_count,
        average_comfort_score=avg_score,
        insights=insights,
    )
