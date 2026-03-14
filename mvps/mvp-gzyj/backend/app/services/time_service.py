"""时间服务 - 管理实时/调试双模式"""
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.models import SystemSetting


class TimeService:
    """时间管理服务"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_time_mode(self) -> str:
        """获取当前时间模式"""
        setting = self.db.query(SystemSetting).filter(
            SystemSetting.key == 'time_mode'
        ).first()
        
        return setting.value if setting else 'realtime'
    
    def get_debug_now(self) -> Optional[datetime]:
        """获取调试模式下的指定时间"""
        setting = self.db.query(SystemSetting).filter(
            SystemSetting.key == 'debug_now'
        ).first()
        
        if setting and setting.value:
            try:
                # 支持两种格式: ISO8601 或 YYYY-MM-DD HH:MM:SS
                value = setting.value.replace(' ', 'T')
                return datetime.fromisoformat(value)
            except ValueError:
                return None
        
        return None
    
    def get_effective_now(self) -> datetime:
        """获取生效的当前时间
        
        实时模式: 返回 datetime.utcnow()
        调试模式: 返回设置的 debug_now 时间
        """
        mode = self.get_time_mode()
        
        if mode == 'debug':
            debug_now = self.get_debug_now()
            if debug_now:
                return debug_now
        
        return datetime.utcnow()
    
    def set_realtime_mode(self):
        """设置为实时模式"""
        mode_setting = self.db.query(SystemSetting).filter(
            SystemSetting.key == 'time_mode'
        ).first()
        
        if mode_setting:
            mode_setting.value = 'realtime'
        else:
            mode_setting = SystemSetting(key='time_mode', value='realtime')
            self.db.add(mode_setting)
        
        self.db.commit()
    
    def set_debug_mode(self, debug_now: str):
        """设置为调试模式
        
        Args:
            debug_now: 格式为 YYYY-MM-DD HH:MM:SS
        """
        # 更新时间模式
        mode_setting = self.db.query(SystemSetting).filter(
            SystemSetting.key == 'time_mode'
        ).first()
        
        if mode_setting:
            mode_setting.value = 'debug'
        else:
            mode_setting = SystemSetting(key='time_mode', value='debug')
            self.db.add(mode_setting)
        
        # 更新调试时间
        time_setting = self.db.query(SystemSetting).filter(
            SystemSetting.key == 'debug_now'
        ).first()
        
        if time_setting:
            time_setting.value = debug_now
        else:
            time_setting = SystemSetting(key='debug_now', value=debug_now)
            self.db.add(time_setting)
        
        self.db.commit()
