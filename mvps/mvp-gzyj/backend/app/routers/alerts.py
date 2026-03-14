"""预警中心路由 - 事件列表、告警记录、事件详情"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models import AlertIncident, AlertEventLog, AlertRecord, AlertRule, ValveRegistry

router = APIRouter(prefix="/api/alerts", tags=["预警中心"])


class IncidentItem(BaseModel):
    """事件列表项"""
    id: int
    rule_id: int
    rule_name: str
    site_code: str
    valve_id: str
    valve_name: Optional[str]
    is_important: bool
    status: str
    triggered_at: datetime
    resolved_at: Optional[datetime]
    last_triggered: datetime
    trigger_count: int
    duration_minutes: Optional[int]


class IncidentListResponse(BaseModel):
    """事件列表响应"""
    total: int
    items: List[IncidentItem]


class EventLogItem(BaseModel):
    """事件日志项"""
    id: int
    event_type: str
    event_time: datetime
    pv_value: Optional[float]
    delta_value: Optional[float]


class IncidentDetailResponse(IncidentItem):
    """事件详情响应"""
    event_logs: List[EventLogItem]


class RecordItem(BaseModel):
    """告警记录项"""
    id: int
    incident_id: Optional[int]
    rule_name: str
    site_code: str
    valve_id: str
    alert_type: str
    alert_time: datetime
    pv_value: Optional[float]
    message: str
    is_read: bool


class RecordListResponse(BaseModel):
    """告警记录列表响应"""
    total: int
    unread_count: int
    items: List[RecordItem]


class ActiveSummaryResponse(BaseModel):
    """活跃事件汇总响应"""
    active_count: int
    sites_affected: List[str]
    latest_incident: Optional[dict]


@router.get("/incidents", response_model=IncidentListResponse)
async def get_incidents(
    site_code: Optional[str] = Query(None, description="按机房筛选"),
    status: Optional[str] = Query(None, pattern="^(active|recovered|closed)$", description="按状态筛选"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    db: Session = Depends(get_db)
):
    """
    获取事件列表（事件视图）
    """
    query = db.query(
        AlertIncident,
        AlertRule.rule_name,
        ValveRegistry.point_name,
        ValveRegistry.is_important
    ).join(
        AlertRule, AlertIncident.rule_id == AlertRule.id
    ).outerjoin(
        ValveRegistry,
        (AlertIncident.site_code == ValveRegistry.site_code) &
        (AlertIncident.valve_id == ValveRegistry.valve_id)
    )
    
    if site_code:
        query = query.filter(AlertIncident.site_code == site_code)
    if status:
        query = query.filter(AlertIncident.status == status)
    
    total = query.count()
    
    results = query.order_by(
        desc(AlertIncident.last_triggered_at)
    ).offset((page - 1) * page_size).limit(page_size).all()
    
    items = []
    for inc, rule_name, valve_name, is_important in results:
        duration = None
        if inc.status == 'active':
            duration = int((datetime.utcnow() - inc.first_triggered_at).total_seconds() / 60)
        elif inc.ended_at:
            duration = int((inc.ended_at - inc.first_triggered_at).total_seconds() / 60)
        
        items.append(IncidentItem(
            id=inc.id,
            rule_id=inc.rule_id,
            rule_name=rule_name,
            site_code=inc.site_code,
            valve_id=inc.valve_id,
            valve_name=valve_name,
            is_important=is_important or False,
            status=inc.status,
            triggered_at=inc.first_triggered_at,
            resolved_at=inc.ended_at,
            last_triggered=inc.last_triggered_at,
            trigger_count=inc.trigger_count,
            duration_minutes=duration
        ))
    
    return IncidentListResponse(total=total, items=items)


@router.get("/incidents/{incident_id}", response_model=IncidentDetailResponse)
async def get_incident_detail(
    incident_id: int,
    db: Session = Depends(get_db)
):
    """
    获取事件详情（含完整事件日志）
    """
    result = db.query(
        AlertIncident,
        AlertRule.rule_name,
        ValveRegistry.point_name,
        ValveRegistry.is_important
    ).join(
        AlertRule, AlertIncident.rule_id == AlertRule.id
    ).outerjoin(
        ValveRegistry,
        (AlertIncident.site_code == ValveRegistry.site_code) &
        (AlertIncident.valve_id == ValveRegistry.valve_id)
    ).filter(AlertIncident.id == incident_id).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="事件不存在")
    
    inc, rule_name, valve_name, is_important = result
    
    # 获取事件日志
    logs = db.query(AlertEventLog).filter(
        AlertEventLog.incident_id == incident_id
    ).order_by(AlertEventLog.event_time).all()
    
    duration = None
    if inc.status == 'active':
        duration = int((datetime.utcnow() - inc.first_triggered_at).total_seconds() / 60)
    elif inc.ended_at:
        duration = int((inc.ended_at - inc.first_triggered_at).total_seconds() / 60)
    
    return IncidentDetailResponse(
        id=inc.id,
        rule_id=inc.rule_id,
        rule_name=rule_name,
        site_code=inc.site_code,
        valve_id=inc.valve_id,
        valve_name=valve_name,
        is_important=is_important or False,
        status=inc.status,
        triggered_at=inc.first_triggered_at,
        resolved_at=inc.ended_at,
        last_triggered=inc.last_triggered_at,
        trigger_count=inc.trigger_count,
        duration_minutes=duration,
        event_logs=[EventLogItem(
            id=log.id,
            event_type=log.event_type,
            event_time=log.event_time,
            pv_value=float(log.pv_value) if log.pv_value else None,
            delta_value=float(log.delta_value) if log.delta_value else None
        ) for log in logs]
    )


@router.get("/active-summary", response_model=ActiveSummaryResponse)
async def get_active_summary(db: Session = Depends(get_db)):
    """
    获取活跃事件汇总
    
    用于顶部导航栏角标显示
    """
    active_count = db.query(AlertIncident).filter(
        AlertIncident.status == 'active'
    ).count()
    
    sites = db.query(AlertIncident.site_code).filter(
        AlertIncident.status == 'active'
    ).distinct().all()
    
    latest = db.query(AlertIncident).filter(
        AlertIncident.status == 'active'
    ).order_by(desc(AlertIncident.last_triggered_at)).first()
    
    latest_dict = None
    if latest:
        latest_dict = {
            "id": latest.id,
            "site_code": latest.site_code,
            "valve_id": latest.valve_id,
            "triggered_at": latest.first_triggered_at.isoformat()
        }
    
    return ActiveSummaryResponse(
        active_count=active_count,
        sites_affected=[s[0] for s in sites],
        latest_incident=latest_dict
    )


@router.get("/records", response_model=RecordListResponse)
async def get_records(
    site_code: Optional[str] = Query(None, description="按机房筛选"),
    is_read: Optional[bool] = Query(None, description="按已读状态筛选"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    db: Session = Depends(get_db)
):
    """
    获取告警记录列表（告警记录Tab）
    """
    query = db.query(
        AlertRecord,
        AlertRule.rule_name
    ).join(
        AlertRule, AlertRecord.rule_id == AlertRule.id
    )
    
    if site_code:
        query = query.filter(AlertRecord.site_code == site_code)
    if is_read is not None:
        query = query.filter(AlertRecord.is_read == is_read)
    
    total = query.count()
    unread_count = db.query(AlertRecord).filter(AlertRecord.is_read == False).count()
    
    results = query.order_by(
        desc(AlertRecord.alert_time)
    ).offset((page - 1) * page_size).limit(page_size).all()
    
    items = []
    for record, rule_name in results:
        # 生成消息文本
        if record.alert_type == 'triggered':
            message = f"【{record.site_code}】{record.valve_id} 触发预警：{rule_name}"
            if record.pv_value:
                message += f"，当前PV {record.pv_value}%"
        else:
            message = f"【{record.site_code}】{record.valve_id} 预警恢复：{rule_name}"
            if record.pv_value:
                message += f"，当前PV {record.pv_value}%"
        
        items.append(RecordItem(
            id=record.id,
            incident_id=record.incident_id,
            rule_name=rule_name,
            site_code=record.site_code,
            valve_id=record.valve_id,
            alert_type=record.alert_type,
            alert_time=record.alert_time,
            pv_value=float(record.pv_value) if record.pv_value else None,
            message=message,
            is_read=record.is_read
        ))
    
    return RecordListResponse(
        total=total,
        unread_count=unread_count,
        items=items
    )


@router.patch("/records/{record_id}/read")
async def mark_record_read(
    record_id: int,
    db: Session = Depends(get_db)
):
    """
    标记单条告警记录为已读
    """
    record = db.query(AlertRecord).filter(AlertRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    record.is_read = True
    db.commit()
    
    return {"id": record_id, "is_read": True}


@router.patch("/records/read-all")
async def mark_all_records_read(db: Session = Depends(get_db)):
    """
    全部标记已读
    """
    updated = db.query(AlertRecord).filter(
        AlertRecord.is_read == False
    ).update({"is_read": True})
    
    db.commit()
    
    return {"updated_count": updated}


@router.post("/incidents/{incident_id}/close")
async def close_incident(
    incident_id: int,
    db: Session = Depends(get_db)
):
    """
    手动关闭事件
    """
    incident = db.query(AlertIncident).filter(
        AlertIncident.id == incident_id
    ).first()
    
    if not incident:
        raise HTTPException(status_code=404, detail="事件不存在")
    
    if incident.status != 'active':
        raise HTTPException(status_code=400, detail="事件已关闭或已恢复")
    
    # 更新事件状态
    incident.status = 'closed'
    incident.ended_at = datetime.utcnow()
    
    # 添加关闭日志
    from app.models import AlertEventLog
    log = AlertEventLog(
        incident_id=incident_id,
        event_type='closed',
        event_time=datetime.utcnow(),
        pv_value=incident.current_pv_value
    )
    db.add(log)
    
    db.commit()
    
    return {"message": "事件已关闭", "incident_id": incident_id}
