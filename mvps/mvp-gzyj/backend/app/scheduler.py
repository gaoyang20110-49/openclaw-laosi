"""调度器 - APScheduler定时任务"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.services.rule_engine import RuleEngine


class TaskScheduler:
    """任务调度器"""
    
    def __init__(self):
        self.scheduler = BackgroundScheduler()
    
    def start(self):
        """启动调度器"""
        # 规则引擎：每分钟执行一次
        self.scheduler.add_job(
            func=self._run_rule_engine,
            trigger=IntervalTrigger(seconds=60),
            id='rule_engine',
            name='规则引擎',
            replace_existing=True
        )
        
        # 存储容量检查：每10分钟执行一次
        self.scheduler.add_job(
            func=self._check_storage,
            trigger=IntervalTrigger(minutes=10),
            id='storage_check',
            name='存储容量检查',
            replace_existing=True
        )
        
        self.scheduler.start()
        print("✅ 调度器已启动")
    
    def shutdown(self):
        """关闭调度器"""
        self.scheduler.shutdown()
        print("✅ 调度器已关闭")
    
    @staticmethod
    def _run_rule_engine():
        """执行规则引擎"""
        db = SessionLocal()
        try:
            engine = RuleEngine(db)
            stats = engine.run()
            print(f"[规则引擎] 执行完成: {stats}")
        except Exception as e:
            print(f"[规则引擎] 执行出错: {e}")
        finally:
            db.close()
    
    @staticmethod
    def _check_storage():
        """检查存储容量"""
        # 存储检查逻辑，可扩展告警通知
        pass


# 全局调度器实例
scheduler = TaskScheduler()
