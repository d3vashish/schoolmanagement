from sqlalchemy import Column, String, Text

from app.core.database import Base
from app.shared.models import TimestampMixin


class SchoolSetting(Base, TimestampMixin):
    __tablename__ = "school_settings"

    key = Column(String(128), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
