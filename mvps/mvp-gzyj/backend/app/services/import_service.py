"""数据导入服务 - 处理Excel/CSV文件解析、校验和入库"""
import io
import pandas as pd
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models import ValveRegistry, TimeseriesData, ImportLog
from app.database import engine


# 字段映射配置
FIELD_MAPPINGS = {
    'timestamp': ['timestamp', '采集时间', '时间', 'time', 'datetime'],
    'site_code': ['site_code', '机房编号', '机房', 'site', '机房代码'],
    'valve_id': ['valve_id', '阀门编号', '阀门', 'valve', '设备编号'],
    'valve_type': ['valve_type', '阀门类型', '类型', 'type', '设备类型'],
    'point_name': ['point_name', '测点名称', '测点', 'point', '名称'],
    'point_id': ['point_id', '测点ID', '点ID', 'pointid'],
    'pv_value': ['pv_value', '开度反馈值', '开度', 'pv', 'PV', '反馈值', 'value'],
    'is_important': ['is_important', '是否重要阀门', '重要', 'important', '是否重要']
}


def normalize_column_name(col_name: str) -> Optional[str]:
    """将上传文件的列名标准化为系统字段名"""
    col_lower = str(col_name).strip().lower()
    for standard_name, aliases in FIELD_MAPPINGS.items():
        if col_lower in [a.lower() for a in aliases]:
            return standard_name
    return None


def validate_row(row: Dict[str, Any], row_num: int) -> Tuple[bool, List[str]]:
    """验证单行数据
    
    Returns:
        (是否通过, 错误列表)
    """
    errors = []
    
    # 必填字段校验
    required_fields = ['timestamp', 'site_code', 'valve_id', 'valve_type', 'pv_value']
    for field in required_fields:
        if field not in row or pd.isna(row[field]) or str(row[field]).strip() == '':
            errors.append(f"第{row_num}行：{field} 不能为空")
    
    if errors:
        return False, errors
    
    # 时间格式校验
    try:
        ts = row['timestamp']
        if isinstance(ts, str):
            # 尝试解析常见时间格式
            for fmt in ['%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y/%m/%d %H:%M']:
                try:
                    datetime.strptime(ts.strip(), fmt)
                    break
                except ValueError:
                    continue
            else:
                errors.append(f"第{row_num}行：时间格式错误，应为 YYYY-MM-DD HH:MM:SS")
    except Exception:
        errors.append(f"第{row_num}行：时间格式解析失败")
    
    # PV值范围校验
    try:
        pv = float(row['pv_value'])
        if pv < 0 or pv > 100:
            errors.append(f"第{row_num}行：pv_value 数值应在 0-100 之间，实际值：{pv}")
    except (ValueError, TypeError):
        errors.append(f"第{row_num}行：pv_value 必须是数值")
    
    # is_important 格式校验（如果有值）
    if 'is_important' in row and not pd.isna(row['is_important']):
        val = str(row['is_important']).strip().lower()
        if val not in ['true', 'false', '1', '0', '是', '否', 'yes', 'no']:
            errors.append(f"第{row_num}行：is_important 应填写 true/false 或 1/0")
    
    return len(errors) == 0, errors


def parse_boolean(value: Any) -> Optional[bool]:
    """解析布尔值"""
    if pd.isna(value):
        return None
    val = str(value).strip().lower()
    if val in ['true', '1', '是', 'yes']:
        return True
    elif val in ['false', '0', '否', 'no']:
        return False
    return None


def parse_timestamp(value: Any) -> datetime:
    """解析时间戳"""
    if isinstance(value, datetime):
        return value
    
    val = str(value).strip()
    for fmt in ['%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y/%m/%d %H:%M']:
        try:
            return datetime.strptime(val, fmt)
        except ValueError:
            continue
    
    # 如果都解析失败，尝试pandas自动解析
    return pd.to_datetime(val)


class ImportService:
    """数据导入服务"""
    
    @staticmethod
    def read_file(file_content: bytes, filename: str) -> pd.DataFrame:
        """读取文件内容到DataFrame"""
        if filename.lower().endswith('.csv'):
            return pd.read_csv(io.BytesIO(file_content))
        elif filename.lower().endswith(('.xlsx', '.xls')):
            return pd.read_excel(io.BytesIO(file_content))
        else:
            raise ValueError("仅支持 .xlsx, .xls 和 .csv 格式文件")
    
    @staticmethod
    def validate_and_transform(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[Dict]]:
        """验证并转换数据
        
        Returns:
            (有效数据DataFrame, 错误明细列表)
        """
        errors = []
        
        # 列名标准化
        column_mapping = {}
        for col in df.columns:
            standard_name = normalize_column_name(col)
            if standard_name:
                column_mapping[col] = standard_name
        
        # 重命名列
        df_renamed = df.rename(columns=column_mapping)
        
        # 检查必需的列是否存在
        required_cols = ['timestamp', 'site_code', 'valve_id', 'valve_type', 'pv_value']
        missing_cols = [c for c in required_cols if c not in df_renamed.columns]
        if missing_cols:
            raise ValueError(f"缺少必需列: {', '.join(missing_cols)}")
        
        # 逐行验证
        valid_rows = []
        for idx, row in df_renamed.iterrows():
            row_num = idx + 2  # Excel行号从2开始（第1行是表头）
            is_valid, row_errors = validate_row(row.to_dict(), row_num)
            
            if is_valid:
                valid_rows.append(idx)
            else:
                errors.extend(row_errors)
        
        return df_renamed.loc[valid_rows], errors
    
    @staticmethod
    def import_data(db: Session, df: pd.DataFrame, file_name: str) -> Dict[str, Any]:
        """导入数据到数据库
        
        Returns:
            导入结果统计
        """
        # 创建导入日志
        import_log = ImportLog(
            file_name=file_name,
            total_rows=len(df),
            status='processing'
        )
        db.add(import_log)
        db.commit()
        db.refresh(import_log)
        
        success_count = 0
        failed_count = 0
        skipped_count = 0
        
        try:
            for _, row in df.iterrows():
                try:
                    # 解析数据
                    timestamp = parse_timestamp(row['timestamp'])
                    site_code = str(row['site_code']).strip()
                    valve_id = str(row['valve_id']).strip()
                    valve_type = str(row['valve_type']).strip()
                    point_name = str(row.get('point_name', '')).strip() if not pd.isna(row.get('point_name')) else None
                    point_id = str(row.get('point_id', '')).strip() if not pd.isna(row.get('point_id')) else None
                    pv_value = float(row['pv_value'])
                    is_important = parse_boolean(row.get('is_important'))
                    
                    # 1. UPSERT 阀门主数据
                    valve = db.query(ValveRegistry).filter(
                        ValveRegistry.site_code == site_code,
                        ValveRegistry.valve_id == valve_id
                    ).first()
                    
                    if valve:
                        # 更新现有阀门
                        valve.valve_type = valve_type
                        if point_name:
                            valve.point_name = point_name
                        if point_id:
                            valve.point_id = point_id
                        # is_important 只在有值时更新
                        if is_important is not None:
                            valve.is_important = is_important
                    else:
                        # 创建新阀门
                        valve = ValveRegistry(
                            site_code=site_code,
                            valve_id=valve_id,
                            valve_type=valve_type,
                            point_name=point_name,
                            point_id=point_id,
                            is_important=is_important if is_important is not None else False
                        )
                        db.add(valve)
                    
                    db.flush()  # 确保阀门记录存在
                    
                    # 2. UPSERT 时序数据（重复则跳过）
                    existing_ts = db.query(TimeseriesData).filter(
                        TimeseriesData.timestamp == timestamp,
                        TimeseriesData.site_code == site_code,
                        TimeseriesData.valve_id == valve_id
                    ).first()
                    
                    if existing_ts:
                        # 重复数据，跳过
                        skipped_count += 1
                    else:
                        # 新建时序数据
                        ts_data = TimeseriesData(
                            timestamp=timestamp,
                            site_code=site_code,
                            valve_id=valve_id,
                            valve_type=valve_type,
                            point_name=point_name,
                            point_id=point_id,
                            pv_value=pv_value,
                            data_source='excel_import'
                        )
                        db.add(ts_data)
                        success_count += 1
                    
                    # 每100条提交一次
                    if success_count % 100 == 0:
                        db.commit()
                        
                except Exception as e:
                    failed_count += 1
                    continue
            
            # 最终提交
            db.commit()
            
            # 更新导入日志状态
            import_log.success_rows = success_count
            import_log.failed_rows = failed_count
            import_log.skipped_rows = skipped_count
            
            if failed_count == 0 and success_count > 0:
                import_log.status = 'completed'
            elif success_count > 0:
                import_log.status = 'partial'
            else:
                import_log.status = 'failed'
            
            import_log.completed_at = datetime.now()
            db.commit()
            
            return {
                "batch_id": str(import_log.batch_id),
                "total_rows": len(df),
                "success_rows": success_count,
                "failed_rows": failed_count,
                "skipped_rows": skipped_count,
                "status": import_log.status
            }
            
        except Exception as e:
            db.rollback()
            import_log.status = 'failed'
            db.commit()
            raise e
