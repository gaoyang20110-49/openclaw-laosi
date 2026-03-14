"""事件日志模型"""
from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import BIGINT
from sqlalchemy.sql import func

from app.database import Base


class AlertEventLog(Base):
    """事件过程日志表"""
    __tablename__ = "alert_event_logs"
    
    id = Column(BIGINT, primary_key=True, autoincrement=True)
    incident_id = Column(BIGINT, ForeignKey("alert_incidents.id"), nullable=False)
    event_type = Column(String(20), nullable=False)  # triggered/ongoing/recovered/closed
    event_time = Column(DateTime, nullable=False)
    pv_value = Column(Numeric(6, 2))
    delta_value = Column(Numeric(6, 2))
    window_info = Column(JSON)  # 窗口快照信息
    created_at = Column(DateTime, nullable=False, server_default=func.now())
