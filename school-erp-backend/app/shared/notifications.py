import logging

logger = logging.getLogger(__name__)

NOTIFICATION_EVENTS = {
    "student.absent": {
        "channels": ["sms", "push"],
        "template": "{student_name} was marked absent on {date}",
    },
    "fee.due_reminder": {
        "channels": ["sms", "email"],
        "template": "Fee of \u20b9{amount} due on {due_date}",
    },
    "fee.paid": {
        "channels": ["sms", "email", "push"],
        "template": "Payment of \u20b9{amount} received. Receipt: {receipt_url}",
    },
    "result.published": {
        "channels": ["push", "email"],
        "template": "{student_name}'s results are now available",
    },
    "leave.approved": {
        "channels": ["sms", "push"],
        "template": "Leave from {start_date} to {end_date} has been approved",
    },
    "leave.rejected": {
        "channels": ["push"],
        "template": "Leave from {start_date} to {end_date} has been rejected",
    },
    "circular.new": {
        "channels": ["push", "email"],
        "template": "{title} \u2014 {body_preview}",
    },
    "student.enrolled": {
        "channels": ["sms", "email"],
        "template": "Welcome! Your account has been created. Email: {email}, Temporary password: {temp_password}",
    },
}


async def get_user_prefs(user_id: str, db) -> dict:
    from app.modules.parent.models import UserNotificationPref
    from sqlalchemy import select

    result = await db.execute(
        select(UserNotificationPref).where(UserNotificationPref.user_id == user_id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        return {"sms": True, "email": True, "push": True}
    return {
        "sms": prefs.sms_enabled,
        "email": prefs.email_enabled,
        "push": prefs.push_enabled,
    }


async def dispatch_sms(user_id: str, message: str) -> None:
    logger.info("SMS to %s: %s", user_id, message[:80])


async def dispatch_email(user_id: str, message: str) -> None:
    logger.info("Email to %s: %s", user_id, message[:80])


async def dispatch_push(user_id: str, message: str) -> None:
    logger.info("Push to %s: %s", user_id, message[:80])


DISPATCHERS = {
    "sms": dispatch_sms,
    "email": dispatch_email,
    "push": dispatch_push,
}


async def dispatch(channel: str, user_id: str, message: str) -> None:
    fn = DISPATCHERS.get(channel)
    if fn:
        try:
            await fn(user_id, message)
        except Exception:
            logger.exception("Failed to send %s to %s", channel, user_id)
