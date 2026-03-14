"""预警事件模型"""
from sqlalchemy import Column, String, Integer, DateTime, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import BIGINT
from sqlalchemy.sql import func

from app.database import Base


class AlertIncident(Base):
    """预警事件表（归并后的事件实体）"""
    __tablename__ = "alert_incidents"
    
    id = Column(BIGINT, primary_key=True, autoincrement=True)
    rule_id = Column(Integer, ForeignKey("alert_rules.id"), nullable=False)
    site_code = Column(String(50), nullable=False)
    valve_id = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default='active')  # active/recovered/closed
    first_triggered_at = Column(DateTime, nullable=False)
    last_triggered_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime)
    trigger_count = Column(Integer, nullable=False, default=1)
    current_pv_value = Column(Numeric(6, 2))
    max_delta_value = Column(Numeric(6, 2))
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
