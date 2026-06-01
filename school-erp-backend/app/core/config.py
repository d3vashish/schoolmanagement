from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "School ERP"
    DATABASE_URL: str
    TEST_DATABASE_URL: str = "postgresql+asyncpg://postgres:123456@localhost:5432/school_test"
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REDIS_URL: str = "redis://localhost:6379"
    S3_ENDPOINT: str
    S3_BUCKET: str
    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    RAZORPAY_KEY_ID: str
    RAZORPAY_SECRET: str
    SMS_API_KEY: str
    FIREBASE_CREDENTIALS: str
    CORS_ORIGINS: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()
