"""规则配置路由 - 预警规则的CRUD和启用/停用"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

from app.database import get_db
from app.models import AlertRule, AlertIncident

router = APIRouter(prefix="/api/rules", tags=["预警规则"])


class SceneAParams(BaseModel):
    """场景A参数"""
    n_points: int = Field(..., ge=2, description="连续点数")
    n_minutes: int = Field(..., ge=1, description="连续分钟数")
    threshold: float = Field(..., ge=0, le=100, description="PV阈值")
    recover_points: int = Field(2, ge=1, description="恢复点数")
    recover_minutes: int = Field(2, ge=1, description="恢复分钟数")


class SceneBParams(BaseModel):
    """场景B参数"""
    window_minutes: int = Field(..., ge=1, description="时间窗口分钟数")
    delta_threshold: float = Field(..., ge=0, le=100, description="波动阈值")
    recover_delta_threshold: Optional[float] = Field(None, description="恢复阈值，默认=触发阈值×0.8")


class RuleCreateRequest(BaseModel):
    """创建规则请求"""
    rule_name: str = Field(..., min_length=1, max_length=100, description="规则名称")
    scene_type: str = Field(..., pattern="^(A|B)$", description="场景类型：A或B")
    site_code: Optional[str] = Field(None, description="适用机房，null=全部机房")
    valve_type_filter: Optional[str] = Field(None, description="阀门类型过滤")
    importance_filter: str = Field("all", pattern="^(all|important|normal)$", description="重要性过滤")
    enabled: bool = Field(True, description="是否启用")
    # 场景参数（根据scene_type选择）
    params: dict = Field(..., description="场景参数")


class RuleUpdateRequest(BaseModel):
    """更新规则请求"""
    rule_name: Optional[str] = Field(None, min_length=1, max_length=100)
    site_code: Optional[str] = None
    valve_type_filter: Optional[str] = None
    importance_filter: Optional[str] = Field(None, pattern="^(all|important|normal)$")
    enabled: Optional[bool] = None
    params: Optional[dict] = None


class RuleItem(BaseModel):
    """规则列表项"""
    id: int
    rule_name: str
    scene_type: str
    site_code: Optional[str]
    valve_type_filter: Optional[str]
    importance_filter: str
    enabled: bool
    params: dict
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RuleListResponse(BaseModel):
    """规则列表响应"""
    total: int
    items: List[RuleItem]


class ToggleRequest(BaseModel):
    """启用/停用请求"""
    enabled: bool


@router.get("", response_model=RuleListResponse)
async def get_rules(
    site_code: Optional[str] = Query(None, description="按机房筛选"),
    enabled: Optional[bool] = Query(None, description="按启用状态筛选"),
    db: Session = Depends(get_db)
):
    """
    获取预警规则列表
    """
    query = db.query(AlertRule)
    
    if site_code:
        query = query.filter(
            (AlertRule.site_code == site_code) | (AlertRule.site_code == None)
        )
    if enabled is not None:
        query = query.filter(AlertRule.enabled == enabled)
    
    total = query.count()
    rules = query.order_by(AlertRule.created_at.desc()).all()
    
    return RuleListResponse(
        total=total,
        items=[RuleItem.from_orm(r) for r in rules]
    )


@router.get("/{rule_id}", response_model=RuleItem)
async def get_rule_detail(
    rule_id: int,
    db: Session = Depends(get_db)
):
    """
    获取规则详情
    """
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    
    return RuleItem.from_orm(rule)


@router.post("", response_model=RuleItem, status_code=201)
async def create_rule(
    request: RuleCreateRequest,
    db: Session = Depends(get_db)
):
    """
    创建预警规则
    
    根据场景类型校验必填参数
    """
    # 校验场景参数
    if request.scene_type == 'A':
        required = ['n_points', 'n_minutes', 'threshold']
        for field in required:
            if field not in request.params:
                raise HTTPException(status_code=422, detail=f"场景A缺少必填参数: {field}")
    elif request.scene_type == 'B':
        required = ['window_minutes', 'delta_threshold']
        for field in required:
            if field not in request.params:
                raise HTTPException(status_code=422, detail=f"场景B缺少必填参数: {field}")
    
    rule = AlertRule(
        rule_name=request.rule_name,
        scene_type=request.scene_type,
        site_code=request.site_code,
        valve_type_filter=request.valve_type_filter,
        importance_filter=request.importance_filter,
        enabled=request.enabled,
        params=request.params
    )
    
    db.add(rule)
    db.commit()
    db.refresh(rule)
    
    return RuleItem.from_orm(rule)


@router.put("/{rule_id}", response_model=RuleItem)
async def update_rule(
    rule_id: int,
    request: RuleUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    更新规则（不允许修改场景类型）
    """
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    
    # 更新字段
    if request.rule_name is not None:
        rule.rule_name = request.rule_name
    if request.site_code is not None:
        rule.site_code = request.site_code
    if request.valve_type_filter is not None:
        rule.valve_type_filter = request.valve_type_filter
    if request.importance_filter is not None:
        rule.importance_filter = request.importance_filter
    if request.enabled is not None:
        rule.enabled = request.enabled
    if request.params is not None:
        rule.params = request.params
    
    db.commit()
    db.refresh(rule)
    
    return RuleItem.from_orm(rule)


@router.delete("/{rule_id}")
async def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db)
):
    """
    删除规则
    
    如果存在关联的活跃预警事件，则拒绝删除
    """
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    
    # 检查是否存在活跃事件
    active_count = db.query(AlertIncident).filter(
        AlertIncident.rule_id == rule_id,
        AlertIncident.status == 'active'
    ).count()
    
    if active_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"该规则存在 {active_count} 个活跃预警事件，请先关闭或等待事件恢复后再删除"
        )
    
    db.delete(rule)
    db.commit()
    
    return {"message": "规则已删除", "rule_id": rule_id}


@router.patch("/{rule_id}/toggle", response_model=RuleItem)
async def toggle_rule(
    rule_id: int,
    request: ToggleRequest,
    db: Session = Depends(get_db)
):
    """
    启用/停用规则
    """
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    
    rule.enabled = request.enabled
    db.commit()
    db.refresh(rule)
    
    return RuleItem.from_orm(rule)
