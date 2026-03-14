"""预警规则模型"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime, JSON
from sqlalchemy.sql import func

from app.database import Base


class AlertRule(Base):
    """预警规则表"""
    __tablename__ = "alert_rules"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_name = Column(String(100), nullable=False)
    scene_type = Column(String(10), nullable=False)  # 'A' 或 'B'
    site_code = Column(String(50))  # NULL = 全部机房
    valve_type_filter = Column(String(100))  # NULL = 不限类型
    importance_filter = Column(String(20), nullable=False, default='all')  # all/important/normal
    enabled = Column(Boolean, nullable=False, default=True)
    params = Column(JSON, nullable=False)  # 场景参数
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
