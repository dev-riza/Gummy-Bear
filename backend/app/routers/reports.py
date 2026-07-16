from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Report
from ..schemas import ReportCreate, ReportOut, ReportUpdate

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("", response_model=list[ReportOut])
def list_reports(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Report)
    if status is not None:
        query = query.filter(Report.status == status)
    return query.order_by(desc(Report.created_at)).all()


@router.post("", response_model=ReportOut, status_code=201)
def create_report(payload: ReportCreate, db: Session = Depends(get_db)):
    report = Report(category=payload.category, comment=payload.comment, status="open")
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/{report_id}", response_model=ReportOut)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.patch("/{report_id}", response_model=ReportOut)
def update_report(report_id: int, payload: ReportUpdate, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(report, field, value)

    db.commit()
    db.refresh(report)
    return report


@router.delete("/{report_id}", status_code=204)
def delete_report(report_id: int, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()
    return Response(status_code=204)
