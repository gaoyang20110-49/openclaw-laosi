"""时序数据路由 - 最新PV值、历史曲线数据"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal

from app.database import get_db
from app.models import TimeseriesData, ValveRegistry

router = APIRouter(prefix="/api/timeseries", tags=["时序数据"])


class LatestValveData(BaseModel):
    """单个阀门的最新数据"""
    valve_id: str
    valve_name: Optional[str]
    valve_type: str
    is_important: bool
    pv_value: Optional[float]
    timestamp: Optional[datetime]


class LatestResponse(BaseModel):
    """最新PV值响应"""
    site_code: str
    effective_time: datetime
    valves: List[LatestValveData]


class HistoryDataPoint(BaseModel):
    """历史数据点"""
    timestamp: datetime
    pv_value: float


class HistoryResponse(BaseModel):
    """历史曲线数据响应"""
    site_code: str
    valve_id: str
    valve_name: Optional[str]
    data: List[HistoryDataPoint]


@router.get("/latest", response_model=LatestResponse)
async def get_latest(
    site_code: str = Query(..., description="机房代码"),
    db: Session = Depends(get_db)
):
    """
    获取指定机房所有阀门的最新PV值
    
    用于监控看板展示
    """
    # 获取该机房的所有阀门
    valves = db.query(ValveRegistry).filter(
        ValveRegistry.site_code == site_code
    ).all()
    
    if not valves:
        return LatestResponse(
            site_code=site_code,
            effective_time=datetime.utcnow(),
            valves=[]
        )
    
    # 为每个阀门查询最新时序数据
    valve_data_list = []
    for valve in valves:
        latest = db.query(TimeseriesData).filter(
            TimeseriesData.site_code == site_code,
            TimeseriesData.valve_id == valve.valve_id
        ).order_by(desc(TimeseriesData.timestamp)).first()
        
        valve_data_list.append(LatestValveData(
            valve_id=valve.valve_id,
            valve_name=valve.point_name,
            valve_type=valve.valve_type,
            is_important=valve.is_important,
            pv_value=float(latest.pv_value) if latest else None,
            timestamp=latest.timestamp if latest else None
        ))
    
    return LatestResponse(
        site_code=site_code,
        effective_time=datetime.utcnow(),
        valves=valve_data_list
    )


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    site_code: str = Query(..., description="机房代码"),
    valve_id: str = Query(..., description="阀门编号"),
    start_time: datetime = Query(..., description="开始时间（ISO8601）"),
    end_time: datetime = Query(..., description="结束时间（ISO8601）"),
    db: Session = Depends(get_db)
):
    """
    获取指定阀门的历史PV曲线数据
    
    用于历史查询页面展示曲线
    """
    # 验证阀门存在
    valve = db.query(ValveRegistry).filter(
        ValveRegistry.site_code == site_code,
        ValveRegistry.valve_id == valve_id
    ).first()
    
    if not valve:
        raise HTTPException(status_code=404, detail="阀门不存在")
    
    # 查询历史数据
    data = db.query(TimeseriesData).filter(
        TimeseriesData.site_code == site_code,
        TimeseriesData.valve_id == valve_id,
        TimeseriesData.timestamp >= start_time,
        TimeseriesData.timestamp <= end_time
    ).order_by(TimeseriesData.timestamp).all()
    
    return HistoryResponse(
        site_code=site_code,
        valve_id=valve_id,
        valve_name=valve.point_name,
        data=[HistoryDataPoint(
            timestamp=d.timestamp,
            pv_value=float(d.pv_value)
        ) for d in data]
    )
