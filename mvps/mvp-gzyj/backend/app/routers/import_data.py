"""导入数据路由 - 处理文件上传和导入历史查询"""
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.services.import_service import ImportService
from app.models import ImportLog

router = APIRouter(prefix="/api/import", tags=["数据导入"])


class ImportResponse(BaseModel):
    """导入响应模型"""
    batch_id: str
    total_rows: int
    success_rows: int
    failed_rows: int
    skipped_rows: int
    status: str
    errors: List[dict] = []


class ImportLogItem(BaseModel):
    """导入日志项"""
    id: int
    batch_id: str
    file_name: str
    total_rows: int
    success_rows: int
    failed_rows: int
    skipped_rows: int
    status: str
    created_at: str

    class Config:
        from_attributes = True


class ImportLogListResponse(BaseModel):
    """导入日志列表响应"""
    total: int
    items: List[ImportLogItem]


@router.post("/upload", response_model=ImportResponse)
async def upload_file(
    file: UploadFile = File(..., description="上传文件 (.xlsx, .xls, .csv)"),
    db: Session = Depends(get_db)
):
    """
    上传并导入数据文件
    
    支持 .xlsx, .xls, .csv 格式
    文件大小限制 50MB，单次最多 5万行
    """
    # 检查文件格式
    filename = file.filename or ""
    if not filename.lower().endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="仅支持 .xlsx, .xls 和 .csv 格式文件")
    
    try:
        # 读取文件内容
        content = await file.read()
        
        # 检查文件大小 (50MB)
        if len(content) > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="文件大小超过 50MB 限制")
        
        # 读取文件到DataFrame
        df = ImportService.read_file(content, filename)
        
        # 检查行数 (5万行)
        if len(df) > 50000:
            raise HTTPException(
                status_code=400, 
                detail=f"单次导入不超过 5 万行，当前文件共 {len(df)} 行，请拆分后分批导入"
            )
        
        # 验证并转换数据
        df_valid, errors = ImportService.validate_and_transform(df)
        
        if len(df_valid) == 0:
            # 全部验证失败
            return ImportResponse(
                batch_id="",
                total_rows=len(df),
                success_rows=0,
                failed_rows=len(df),
                skipped_rows=0,
                status="failed",
                errors=[{"row": i+2, "error": e} for i, e in enumerate(errors[:10])]  # 最多返回10条错误
            )
        
        # 导入数据
        result = ImportService.import_data(db, df_valid, filename)
        
        # 添加验证错误信息
        result["errors"] = [{"row": i+2, "error": e} for i, e in enumerate(errors[:20])]
        
        return ImportResponse(**result)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.get("/logs", response_model=ImportLogListResponse)
async def get_import_logs(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db)
):
    """
    获取导入历史记录
    """
    # 计算分页
    offset = (page - 1) * page_size
    
    # 查询总数
    total = db.query(ImportLog).count()
    
    # 查询列表
    logs = db.query(ImportLog).order_by(
        ImportLog.started_at.desc()
    ).offset(offset).limit(page_size).all()
    
    # 转换响应格式
    items = []
    for log in logs:
        items.append(ImportLogItem(
            id=log.id,
            batch_id=str(log.batch_id),
            file_name=log.file_name,
            total_rows=log.total_rows,
            success_rows=log.success_rows,
            failed_rows=log.failed_rows,
            skipped_rows=log.skipped_rows,
            status=log.status,
            created_at=log.started_at.isoformat() if log.started_at else ""
        ))
    
    return ImportLogListResponse(total=total, items=items)


@router.get("/logs/{batch_id}")
async def get_import_log_detail(
    batch_id: str,
    db: Session = Depends(get_db)
):
    """
    获取导入批次详情
    """
    from uuid import UUID
    
    try:
        uuid_obj = UUID(batch_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的 batch_id 格式")
    
    log = db.query(ImportLog).filter(ImportLog.batch_id == uuid_obj).first()
    
    if not log:
        raise HTTPException(status_code=404, detail="导入记录不存在")
    
    return {
        "id": log.id,
        "batch_id": str(log.batch_id),
        "file_name": log.file_name,
        "total_rows": log.total_rows,
        "success_rows": log.success_rows,
        "failed_rows": log.failed_rows,
        "skipped_rows": log.skipped_rows,
        "error_detail": log.error_detail,
        "status": log.status,
        "started_at": log.started_at.isoformat() if log.started_at else None,
        "completed_at": log.completed_at.isoformat() if log.completed_at else None
    }
