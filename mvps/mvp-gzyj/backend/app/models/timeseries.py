"""时序数据模型"""
from sqlalchemy import Column, String, DateTime, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import BIGINT
from sqlalchemy.sql import func

from app.database import Base


class TimeseriesData(Base):
    """时序数据表"""
    __tablename__ = "timeseries_data"
    
    id = Column(BIGINT, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, nullable=False)
    site_code = Column(String(50), nullable=False)
    valve_id = Column(String(50), nullable=False)
    valve_type = Column(String(100))
    point_name = Column(String(200))
    point_id = Column(String(100))
    pv_value = Column(Numeric(6, 2), nullable=False)
    data_source = Column(String(50), nullable=False, default='excel_import')
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    
    __table_args__ = (
        UniqueConstraint('timestamp', 'site_code', 'valve_id', name='uq_timeseries'),
    )
