from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.rate_limit import limiter
from app.modules.auth.router import router as auth_router
from app.modules.academic.router import router as academic_router
from app.modules.admissions.router import router as admissions_router
from app.modules.fees.router import router as fees_router
from app.modules.attendance.router import router as attendance_router
from app.modules.timetable.router import router as timetable_router
from app.modules.exams.router import router as exams_router
from app.modules.library.router import router as library_router
from app.modules.staff.router import router as staff_router
from app.modules.parent.router import router as parent_router
from app.modules.homework.router import router as homework_router
from app.modules.class_tests.router import router as class_tests_router
from app.modules.admin.router import router as admin_router
from app.modules.notifications.router import router as notifications_router

app = FastAPI(title=settings.APP_NAME)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
origins = settings.CORS_ORIGINS.split(",") if hasattr(settings, "CORS_ORIGINS") and settings.CORS_ORIGINS else [
    "http://localhost:5173", "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(academic_router)
app.include_router(admissions_router)
app.include_router(fees_router)
app.include_router(attendance_router)
app.include_router(timetable_router)
app.include_router(exams_router)
app.include_router(library_router)
app.include_router(staff_router)
app.include_router(parent_router)
app.include_router(class_tests_router)
app.include_router(homework_router)
app.include_router(admin_router)
app.include_router(notifications_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Serve built frontend (SPA) — must be last so API routes take priority ──
_DIST = Path(__file__).resolve().parent.parent.parent / "schoolerp" / "dist"
if _DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_DIST / "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file = _DIST / full_path
        if file.is_file():
            return FileResponse(str(file))
        return FileResponse(str(_DIST / "index.html"))