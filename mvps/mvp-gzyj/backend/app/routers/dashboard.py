"""监控看板路由 - 汇总统计、实时数据"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models import ValveRegistry, TimeseriesData, AlertIncident

router = APIRouter(prefix="/api/dashboard", tags=["监控看板"])


class SiteSummary(BaseModel):
    """机房汇总信息"""
    site_code: str
    valve_count: int
    active_incidents: int


class DashboardSummaryResponse(BaseModel):
    """看板汇总响应"""
    total_valves: int
    active_incidents: int
    sites: List[SiteSummary]


class RealtimeValveData(BaseModel):
    """实时阀门数据"""
    valve_id: str
    valve_name: Optional[str]
    valve_type: str
    is_important: bool
    pv_value: Optional[float]
    timestamp: Optional[datetime]
    has_active_incident: bool  # 是否有活跃预警事件


class DashboardRealtimeResponse(BaseModel):
    """实时监控数据响应"""
    site_code: str
    effective_time: datetime
    valves: List[RealtimeValveData]


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    获取看板汇总统计
    
    返回总阀门数、活跃预警事件数、各机房统计
    """
    # 总阀门数
    total_valves = db.query(ValveRegistry).count()
    
    # 活跃预警事件数
    active_incidents = db.query(AlertIncident).filter(
        AlertIncident.status == 'active'
    ).count()
    
    # 各机房统计
    site_stats = db.query(
        ValveRegistry.site_code,
        func.count(ValveRegistry.id).label('valve_count')
    ).group_by(ValveRegistry.site_code).all()
    
    # 各机房活跃事件数
    incident_counts = db.query(
        AlertIncident.site_code,
        func.count(AlertIncident.id).label('incident_count')
    ).filter(
        AlertIncident.status == 'active'
    ).group_by(AlertIncident.site_code).all()
    
    incident_dict = {s: c for s, c in incident_counts}
    
    sites = [
        SiteSummary(
            site_code=site_code,
            valve_count=valve_count,
            active_incidents=incident_dict.get(site_code, 0)
        )
        for site_code, valve_count in site_stats
    ]
    
    return DashboardSummaryResponse(
        total_valves=total_valves,
        active_incidents=active_incidents,
        sites=sites
    )


@router.get("/realtime", response_model=DashboardRealtimeResponse)
async def get_dashboard_realtime(
    site_code: Optional[str] = Query(None, description="机房代码，不传则返回所有"),
    db: Session = Depends(get_db)
):
    """
    获取实时监控数据
    
    返回各阀门最新PV值及是否有活跃预警事件
    """
    # 构建阀门查询
    valve_query = db.query(ValveRegistry)
    if site_code:
        valve_query = valve_query.filter(ValveRegistry.site_code == site_code)
    
    valves = valve_query.all()
    
    # 获取所有有机房活跃事件的阀门
    active_incident_valves = set()
    if site_code:
        incidents = db.query(AlertIncident).filter(
            AlertIncident.site_code == site_code,
            AlertIncident.status == 'active'
        ).all()
    else:
        incidents = db.query(AlertIncident).filter(
            AlertIncident.status == 'active'
        ).all()
    
    for inc in incidents:
        active_incident_valves.add((inc.site_code, inc.valve_id))
    
    # 为每个阀门查询最新数据
    valve_data_list = []
    for valve in valves:
        latest = db.query(TimeseriesData).filter(
            TimeseriesData.site_code == valve.site_code,
            TimeseriesData.valve_id == valve.valve_id
        ).order_by(desc(TimeseriesData.timestamp)).first()
        
        valve_data_list.append(RealtimeValveData(
            valve_id=valve.valve_id,
            valve_name=valve.point_name,
            valve_type=valve.valve_type,
            is_important=valve.is_important,
            pv_value=float(latest.pv_value) if latest else None,
            timestamp=latest.timestamp if latest else None,
            has_active_incident=(valve.site_code, valve.valve_id) in active_incident_valves
        ))
    
    return DashboardRealtimeResponse(
        site_code=site_code or "all",
        effective_time=datetime.utcnow(),
        valves=valve_data_list
    )
