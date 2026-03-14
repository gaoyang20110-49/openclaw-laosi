"""系统设置模型"""
from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func

from app.database import Base


class SystemSetting(Base):
    """系统设置表"""
    __tablename__ = "system_settings"
    
    key = Column(String(100), primary_key=True)
    value = Column(String, nullable=False)
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
