"""阀门管理路由 - 阀门列表、机房列表、重要性标记"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models import ValveRegistry

router = APIRouter(prefix="/api/valves", tags=["阀门管理"])


class ValveItem(BaseModel):
    """阀门列表项"""
    id: int
    site_code: str
    valve_id: str
    valve_type: str
    point_name: Optional[str]
    point_id: Optional[str]
    is_important: bool
    updated_at: datetime

    class Config:
        from_attributes = True


class ValveListResponse(BaseModel):
    """阀门列表响应"""
    total: int
    items: List[ValveItem]


class ValveDetailResponse(ValveItem):
    """阀门详情响应"""
    created_at: datetime


class ImportanceUpdateRequest(BaseModel):
    """重要性更新请求"""
    is_important: bool


class ImportanceUpdateResponse(BaseModel):
    """重要性更新响应"""
    site_code: str
    valve_id: str
    is_important: bool
    updated_at: datetime


class SitesResponse(BaseModel):
    """机房列表响应"""
    sites: List[str]


@router.get("", response_model=ValveListResponse)
async def get_valves(
    site_code: Optional[str] = Query(None, description="按机房筛选"),
    valve_type: Optional[str] = Query(None, description="按类型筛选"),
    is_important: Optional[bool] = Query(None, description="按重要性筛选"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=200, description="每页条数"),
    db: Session = Depends(get_db)
):
    """
    获取阀门列表
    
    支持按机房、类型、重要性筛选，支持分页
    """
    query = db.query(ValveRegistry)
    
    # 应用筛选条件
    if site_code:
        query = query.filter(ValveRegistry.site_code == site_code)
    if valve_type:
        query = query.filter(ValveRegistry.valve_type == valve_type)
    if is_important is not None:
        query = query.filter(ValveRegistry.is_important == is_important)
    
    # 计算总数
    total = query.count()
    
    # 分页查询
    offset = (page - 1) * page_size
    valves = query.order_by(
        ValveRegistry.site_code,
        ValveRegistry.valve_id
    ).offset(offset).limit(page_size).all()
    
    return ValveListResponse(
        total=total,
        items=[ValveItem.from_orm(v) for v in valves]
    )


@router.get("/sites", response_model=SitesResponse)
async def get_sites(db: Session = Depends(get_db)):
    """
    获取所有机房代码列表
    
    用于前端下拉选择器
    """
    sites = db.query(ValveRegistry.site_code).distinct().order_by(
        ValveRegistry.site_code
    ).all()
    
    return SitesResponse(sites=[s[0] for s in sites])


@router.get("/{site_code}/{valve_id}", response_model=ValveDetailResponse)
async def get_valve_detail(
    site_code: str,
    valve_id: str,
    db: Session = Depends(get_db)
):
    """
    获取阀门详情
    """
    valve = db.query(ValveRegistry).filter(
        ValveRegistry.site_code == site_code,
        ValveRegistry.valve_id == valve_id
    ).first()
    
    if not valve:
        raise HTTPException(status_code=404, detail="阀门不存在")
    
    return ValveDetailResponse.from_orm(valve)


@router.patch("/{site_code}/{valve_id}/importance", response_model=ImportanceUpdateResponse)
async def update_importance(
    site_code: str,
    valve_id: str,
    request: ImportanceUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    手动切换阀门重要性标记
    """
    valve = db.query(ValveRegistry).filter(
        ValveRegistry.site_code == site_code,
        ValveRegistry.valve_id == valve_id
    ).first()
    
    if not valve:
        raise HTTPException(status_code=404, detail="阀门不存在")
    
    valve.is_important = request.is_important
    db.commit()
    db.refresh(valve)
    
    return ImportanceUpdateResponse(
        site_code=valve.site_code,
        valve_id=valve.valve_id,
        is_important=valve.is_important,
        updated_at=valve.updated_at
    )
