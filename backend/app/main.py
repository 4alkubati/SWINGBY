from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.database import engine
from sqlalchemy import text
import os

load_dotenv()

app = FastAPI(title="SwingBy API", version="1.0.0")

_default_origins = ["http://localhost:5173", "http://localhost:3000"]
_extra_origins = [
    o.strip()
    for o in os.getenv("SWINGBY_ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]
_allowed_origins = _default_origins + _extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.auth import router as auth_router
app.include_router(auth_router, prefix="/auth", tags=["auth"])

from app.api.businesses import router as businesses_router
app.include_router(businesses_router, prefix="/businesses", tags=["businesses"])

from app.api.waitlist import router as waitlist_router
app.include_router(waitlist_router, prefix="/waitlist", tags=["waitlist"])

from app.api.employees import router as employees_router
app.include_router(employees_router, prefix="/employees", tags=["employees"])

from app.api.service_posts import router as service_posts_router
app.include_router(service_posts_router, prefix="/service-posts", tags=["service-posts"])

from app.api.interests import router as interests_router
app.include_router(interests_router, prefix="/interests", tags=["interests"])

from app.api.bookings import router as bookings_router
app.include_router(bookings_router, prefix="/bookings", tags=["bookings"])

from app.api.payments import router as payments_router
app.include_router(payments_router, prefix="/payments", tags=["payments"])

from app.api.reviews import router as reviews_router
app.include_router(reviews_router, prefix="/reviews", tags=["reviews"])

from app.api.messages import router as messages_router
app.include_router(messages_router, prefix="/messages", tags=["messages"])


@app.get("/health")
def health_check():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}