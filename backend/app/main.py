import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, SessionLocal, engine
from .routers import events, preferences, readings, reports, summary
from .seed import seed_events_if_empty, seed_if_empty

app = FastAPI(title="AtriumSense API", version="1.0.0")

allowed_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_if_empty(db)
        seed_events_if_empty(db)
    finally:
        db.close()


app.include_router(readings.router)
app.include_router(summary.router)
app.include_router(reports.router)
app.include_router(events.router)
app.include_router(preferences.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
