from __future__ import annotations

import re
from uuid import uuid4

import boto3

from app.settings import settings

_SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


def s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
    )


def sanitize_filename(filename: str) -> str:
    filename = filename.strip().split("/")[-1].split("\\")[-1]
    filename = _SAFE_FILENAME_RE.sub("_", filename)
    return filename[:200] or "upload"


def build_object_key(*, user_id: int, filename: str) -> str:
    safe = sanitize_filename(filename)
    return f"users/{user_id}/{uuid4().hex}_{safe}"

