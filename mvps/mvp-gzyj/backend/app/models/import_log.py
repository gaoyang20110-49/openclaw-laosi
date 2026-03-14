"""导入日志模型"""
from sqlalchemy import Column, String, Integer, DateTime, JSON
from sqlalchemy.dialects.postgresql import BIGINT, UUID
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.database import Base


class ImportLog(Base):
    """导入日志表"""
    __tablename__ = "import_logs"
    
    id = Column(BIGINT, primary_key=True, autoincrement=True)
    batch_id = Column(PGUUID, nullable=False, server_default=func.gen_random_uuid())
    file_name = Column(String(255), nullable=False)
    total_rows = Column(Integer, nullable=False, default=0)
    success_rows = Column(Integer, nullable=False, default=0)
    failed_rows = Column(Integer, nullable=False, default=0)
    skipped_rows = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default='processing')  # processing/completed/failed/partial
    error_detail = Column(JSON)
    started_at = Column(DateTime, nullable=False, server_default=func.now())
    completed_at = Column(DateTime)
