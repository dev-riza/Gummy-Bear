from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, ConfigDict

Location = Literal["atrium", "outside"]
ReportCategory = Literal[
    "too_hot", "too_noisy", "too_bright", "too_dark", "comfortable", "other"
]
ReportStatus = Literal["open", "resolved"]


class ReadingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    measured_at: datetime
    location: Location
    temperature: float
    brightness: Optional[str] = None
    noise: Optional[str] = None


class ReadingWithStatus(ReadingOut):
    temperature_status: Optional[str] = None
    noise_status: Optional[str] = None
    brightness_status: Optional[str] = None
    comfort_score: Optional[int] = None


class CurrentState(BaseModel):
    atrium: Optional[ReadingWithStatus] = None
    outside: Optional[ReadingOut] = None
    indoor_outdoor_diff: Optional[float] = None
    overall_status: str
    recommendation: str


class DailyStat(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None
    avg: Optional[float] = None
    count: int = 0


class Insight(BaseModel):
    label: str
    value: str
    detail: Optional[str] = None


class SummaryOut(BaseModel):
    date: str
    atrium_temperature: DailyStat
    outside_temperature: DailyStat
    indoor_outdoor_avg_diff: Optional[float] = None
    uncomfortable_readings: int
    average_comfort_score: Optional[int] = None
    insights: list[Insight]


class ReportCreate(BaseModel):
    category: ReportCategory
    comment: Optional[str] = Field(default=None, max_length=500)


class ReportUpdate(BaseModel):
    category: Optional[ReportCategory] = None
    comment: Optional[str] = Field(default=None, max_length=500)
    status: Optional[ReportStatus] = None


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    category: ReportCategory
    comment: Optional[str] = None
    status: ReportStatus


class PaginatedReadings(BaseModel):
    items: list[ReadingWithStatus]
    total: int
    page: int
    page_size: int
