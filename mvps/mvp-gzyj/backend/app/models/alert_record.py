"""告警记录模型"""
from sqlalchemy import Column, String, Integer, DateTime, Numeric, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import BIGINT
from sqlalchemy.sql import func

from app.database import Base


class AlertRecord(Base):
    """告警记录表（用户可见的通知记录）"""
    __tablename__ = "alert_records"
    
    id = Column(BIGINT, primary_key=True, autoincrement=True)
    incident_id = Column(BIGINT, ForeignKey("alert_incidents.id"))
    rule_id = Column(Integer, ForeignKey("alert_rules.id"), nullable=False)
    site_code = Column(String(50), nullable=False)
    valve_id = Column(String(50), nullable=False)
    alert_type = Column(String(20), nullable=False)  # triggered/recovered
    alert_time = Column(DateTime, nullable=False)
    pv_value = Column(Numeric(6, 2))
    delta_value = Column(Numeric(6, 2))
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
