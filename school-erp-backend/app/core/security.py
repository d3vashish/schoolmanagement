import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.redis import redis_client

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"

_redis_available = True


def _check_redis():
    global _redis_available
    return _redis_available


async def _redis_set(key, value, ttl):
    global _redis_available
    try:
        await redis_client.setex(key, ttl, value)
    except Exception:
        _redis_available = False


async def _redis_get(key):
    global _redis_available
    try:
        return await redis_client.get(key)
    except Exception:
        _redis_available = False
        return None


async def _redis_delete(key):
    global _redis_available
    try:
        await redis_client.delete(key)
    except Exception:
        _redis_available = False


async def _redis_pipe(commands):
    global _redis_available
    try:
        pipe = redis_client.pipeline()
        for cmd, args in commands:
            getattr(pipe, cmd)(*args)
        return await pipe.execute()
    except Exception:
        _redis_available = False
        return [None] * len(commands)


async def _redis_incr(key):
    global _redis_available
    try:
        return await redis_client.incr(key)
    except Exception:
        _redis_available = False
        return 0


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "role": role, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


async def create_refresh_token(user_id: str) -> str:
    token = secrets.token_urlsafe(64)
    await _redis_set(
        f"refresh:{token}",
        user_id,
        int(timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS).total_seconds()),
    )
    return token


async def consume_refresh_token(token: str) -> str | None:
    results = await _redis_pipe([
        ("get", [f"refresh:{token}"]),
        ("delete", [f"refresh:{token}"]),
    ])
    return results[0] if results else None


async def revoke_refresh_token(token: str) -> None:
    await _redis_delete(f"refresh:{token}")


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return {}


def create_otp() -> str:
    return f"{secrets.randbelow(1000000):06d}"


async def store_otp(phone: str, otp: str) -> None:
    await _redis_set(f"otp:{phone}", otp, 300)


async def verify_otp(phone: str, otp: str) -> bool:
    stored = await _redis_get(f"otp:{phone}")
    if stored is None or stored != otp:
        return False
    await _redis_delete(f"otp:{phone}")
    return True


async def check_otp_rate_limit(phone: str) -> bool:
    key = f"otp_rate:{phone}"
    count = await _redis_incr(key)
    if count == 1:
        try:
            await redis_client.expire(key, 900)
        except Exception:
            pass
    return count <= 3
