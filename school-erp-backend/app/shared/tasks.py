from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "school_erp",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=300,
    task_time_limit=600,
    task_max_retries=3,
    task_default_retry_delay=60,
)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_notification(self, event: str, context: dict, user_ids: list[str]) -> dict:
    import asyncio

    from app.shared.notifications import DISPATCHERS, NOTIFICATION_EVENTS, get_user_prefs

    cfg = NOTIFICATION_EVENTS.get(event)
    if not cfg:
        raise ValueError(f"Unknown notification event: {event}")

    message = cfg["template"].format(**context)
    results = {"sent": 0, "failed": 0, "users": len(user_ids)}

    async def _send():
        from app.core.database import AsyncSessionLocal
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            for uid in user_ids:
                prefs = await get_user_prefs(uid, db)
                for channel in cfg["channels"]:
                    key = channel
                    if not prefs.get(key, True):
                        continue
                    fn = DISPATCHERS.get(channel)
                    if fn:
                        try:
                            await fn(uid, message)
                            results["sent"] += 1
                        except Exception:
                            results["failed"] += 1

    asyncio.run(_send())
    return results
