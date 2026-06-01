import boto3
from botocore.config import Config as BotoConfig

from app.core.config import settings

s3_client = boto3.client(
    "s3",
    endpoint_url=settings.S3_ENDPOINT,
    aws_access_key_id=settings.S3_ACCESS_KEY,
    aws_secret_access_key=settings.S3_SECRET_KEY,
    config=BotoConfig(signature_version="s3v4"),
)


async def upload_file(file_path: str, object_name: str, bucket: str | None = None) -> str:
    bucket = bucket or settings.S3_BUCKET
    s3_client.upload_file(file_path, bucket, object_name)
    return f"{settings.S3_ENDPOINT}/{bucket}/{object_name}"


async def delete_file(object_name: str, bucket: str | None = None) -> None:
    bucket = bucket or settings.S3_BUCKET
    s3_client.delete_object(Bucket=bucket, Key=object_name)


async def get_presigned_url(object_name: str, expires_in: int = 3600, bucket: str | None = None) -> str:
    bucket = bucket or settings.S3_BUCKET
    return s3_client.generate_presigned_url(
        "get_object", Params={"Bucket": bucket, "Key": object_name}, ExpiresIn=expires_in
    )
