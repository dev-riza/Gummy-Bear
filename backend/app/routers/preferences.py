from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Preference
from ..schemas import PreferenceIn, PreferenceOut

router = APIRouter(prefix="/api/preferences", tags=["preferences"])


@router.get("/{visitor_id}", response_model=PreferenceOut)
def get_preference(visitor_id: str, db: Session = Depends(get_db)):
    preference = db.query(Preference).filter(Preference.visitor_id == visitor_id).first()
    if preference is None:
        raise HTTPException(status_code=404, detail="No saved preference for this visitor")
    return preference


@router.put("/{visitor_id}", response_model=PreferenceOut)
def save_preference(visitor_id: str, payload: PreferenceIn, db: Session = Depends(get_db)):
    preference = db.query(Preference).filter(Preference.visitor_id == visitor_id).first()
    if preference is None:
        preference = Preference(visitor_id=visitor_id)
        db.add(preference)

    preference.preferred_temp = payload.preferred_temp
    preference.preferred_noise = payload.preferred_noise
    preference.preferred_brightness = payload.preferred_brightness

    db.commit()
    db.refresh(preference)
    return preference
