"""阀门主数据模型"""
from sqlalchemy import Column, String, Boolean, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import BIGINT
from sqlalchemy.sql import func

from app.database import Base


class ValveRegistry(Base):
    """阀门主数据表（SSOT）"""
    __tablename__ = "valve_registry"
    
    id = Column(BIGINT, primary_key=True, autoincrement=True)
    site_code = Column(String(50), nullable=False)
    valve_id = Column(String(50), nullable=False)
    valve_type = Column(String(100), nullable=False)
    point_name = Column(String(200))
    point_id = Column(String(100))
    is_important = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint('site_code', 'valve_id', name='uq_site_valve'),
    )
