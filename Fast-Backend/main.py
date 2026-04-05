from collections import deque
import re
from time import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import ai_chat
import admin
import bookings
import models
import notifications
import payments
import reviews
import seed_data
import services
import support
import uploads
import users
from config import settings
from database import SessionLocal, engine
from pathlib import Path

models.Base.metadata.create_all(bind=engine)

RATE_LIMITED_PREFIXES = (
    "/api/users/login",
    "/api/users/register",
    "/api/users/login/request-otp",
    "/api/users/login/verify-otp",
    "/api/uploads/",
    "/api/payments/",
)
_request_buckets: dict[str, deque[float]] = {}

if settings.APP_ENV == "development":
    db = SessionLocal()
    try:
        seed_data.seed_database(db)
    finally:
        db.close()

app = FastAPI(
    title=settings.APP_NAME,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(services.router, prefix="/api/services", tags=["Services"])
app.include_router(bookings.router, prefix="/api/bookings", tags=["Bookings"])
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(uploads.router, prefix="/api/uploads", tags=["Uploads"])
app.include_router(ai_chat.router, prefix="/api/ai", tags=["AI Chat"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["Reviews"])
app.include_router(support.router, prefix="/api/support", tags=["Support"])
app.mount("/uploads", StaticFiles(directory=Path(__file__).resolve().parent / "uploads"), name="uploads")


def _origin_allowed(origin: str | None) -> bool:
    if not origin:
        return False
    if origin in settings.CORS_ORIGINS:
        return True
    if settings.CORS_ORIGIN_REGEX:
        try:
            return re.fullmatch(settings.CORS_ORIGIN_REGEX, origin) is not None
        except re.error:
            return False
    return False


@app.middleware("http")
async def ensure_cors_headers(request: Request, call_next):
    origin = request.headers.get("origin")

    if request.method == "OPTIONS" and _origin_allowed(origin):
        return JSONResponse(
            status_code=200,
            content={"ok": True},
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers", "*"),
                "Vary": "Origin",
            },
        )

    response = await call_next(request)

    if _origin_allowed(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = request.headers.get("access-control-request-headers", "*")
        response.headers["Vary"] = "Origin"

    return response


@app.middleware("http")
async def basic_rate_limit(request: Request, call_next):
    path = request.url.path
    if any(path.startswith(prefix) for prefix in RATE_LIMITED_PREFIXES):
        client_host = request.client.host if request.client else "unknown"
        key = f"{client_host}:{path}"
        now = time()
        bucket = _request_buckets.setdefault(key, deque())
        window_start = now - settings.RATE_LIMIT_WINDOW_SECONDS
        while bucket and bucket[0] < window_start:
            bucket.popleft()
        if len(bucket) >= settings.RATE_LIMIT_MAX_REQUESTS:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again shortly."},
            )
        bucket.append(now)
    return await call_next(request)

@app.get("/")
def root():
    return {"message": "HyperLocal API is running", "version": settings.APP_VERSION}

@app.get("/healthcheck")
def health():
    return {"status": "healthy", "environment": settings.APP_ENV}


@app.get("/health")
def health_alias():
    return {"status": "healthy", "environment": settings.APP_ENV}
