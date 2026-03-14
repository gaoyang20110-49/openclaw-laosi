"""系统设置路由 - 时间模式切换、存储使用情况"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from app.database import get_db
from app.models import SystemSetting
from app.services.time_service import TimeService

router = APIRouter(prefix="/api/system", tags=["系统设置"])


class TimeModeResponse(BaseModel):
    """时间模式响应"""
    mode: str
    debug_now: Optional[str] = None
    effective_now: str


class TimeModeUpdateRequest(BaseModel):
    """时间模式更新请求"""
    mode: str  # realtime 或 debug
    debug_now: Optional[str] = None  # YYYY-MM-DD HH:MM:SS 格式


class StorageUsageResponse(BaseModel):
    """存储使用情况响应"""
    used_bytes: int
    limit_bytes: int
    used_percent: float


@router.get("/time-mode", response_model=TimeModeResponse)
async def get_time_mode(db: Session = Depends(get_db)):
    """
    获取当前时间模式
    
    mode: realtime（实时模式）或 debug（调试模式）
    debug_now: 调试模式下的指定时间（ISO8601格式）
    effective_now: 当前生效时间
    """
    time_service = TimeService(db)
    mode = time_service.get_time_mode()
    debug_now = time_service.get_debug_now()
    effective_now = time_service.get_effective_now()
    
    return TimeModeResponse(
        mode=mode,
        debug_now=debug_now.isoformat() if debug_now else None,
        effective_now=effective_now.isoformat()
    )


@router.put("/time-mode", response_model=TimeModeResponse)
async def update_time_mode(
    request: TimeModeUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    切换时间模式
    
    - realtime: 使用当前系统时间
    - debug: 使用指定的历史时间（用于测试）
    """
    time_service = TimeService(db)
    
    if request.mode not in ['realtime', 'debug']:
        raise HTTPException(status_code=400, detail="模式必须是 'realtime' 或 'debug'")
    
    if request.mode == 'debug':
        if not request.debug_now:
            raise HTTPException(status_code=400, detail="调试模式下必须指定 debug_now 时间")
        
        # 验证时间格式
        try:
            debug_time = datetime.fromisoformat(request.debug_now.replace(' ', 'T'))
        except ValueError:
            raise HTTPException(status_code=400, detail="时间格式错误，应为 YYYY-MM-DD HH:MM:SS")
        
        # 验证不能是未来时间
        if debug_time > datetime.utcnow():
            raise HTTPException(status_code=400, detail="调试时间不能晚于当前时间")
        
        time_service.set_debug_mode(request.debug_now)
    else:
        time_service.set_realtime_mode()
    
    # 返回更新后的状态
    mode = time_service.get_time_mode()
    debug_now = time_service.get_debug_now()
    effective_now = time_service.get_effective_now()
    
    return TimeModeResponse(
        mode=mode,
        debug_now=debug_now.isoformat() if debug_now else None,
        effective_now=effective_now.isoformat()
    )


@router.get("/storage-usage", response_model=StorageUsageResponse)
async def get_storage_usage(db: Session = Depends(get_db)):
    """
    获取数据库存储使用情况
    
    返回已使用字节数、上限字节数、使用百分比
    """
    from sqlalchemy import text
    
    # 获取存储上限（默认1GB）
    limit_setting = db.query(SystemSetting).filter(
        SystemSetting.key == 'storage_limit_bytes'
    ).first()
    
    limit_bytes = int(limit_setting.value) if limit_setting else 1073741824  # 1GB
    
    # 查询数据库大小
    result = db.execute(text("""
        SELECT pg_database_size(current_database()) as db_size
    """))
    
    used_bytes = result.scalar() or 0
    used_percent = round((used_bytes / limit_bytes) * 100, 1)
    
    return StorageUsageResponse(
        used_bytes=used_bytes,
        limit_bytes=limit_bytes,
        used_percent=used_percent
    )
