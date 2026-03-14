"""数据库连接和初始化"""
import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.config import settings

# 创建数据库引擎
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_database():
    """初始化数据库（执行DDL）"""
    # 读取DDL文件
    migration_path = os.path.join(os.path.dirname(__file__), '..', 'migrations', 'init.sql')
    with open(migration_path, 'r', encoding='utf-8') as f:
        ddl_content = f.read()
    
    # 移除注释行
    lines = ddl_content.split('\n')
    cleaned_lines = []
    for line in lines:
        # 跳过注释行
        stripped = line.strip()
        if stripped.startswith('--') or stripped.startswith('#'):
            continue
        cleaned_lines.append(line)
    
    ddl_cleaned = '\n'.join(cleaned_lines)
    
    # 按分号分割并执行每个DDL语句
    statements = [s.strip() for s in ddl_cleaned.split(';') if s.strip()]
    
    with engine.connect() as conn:
        for stmt in statements:
            if stmt and not stmt.startswith('--'):
                try:
                    conn.execute(text(stmt))
                except Exception as e:
                    # 忽略"表/索引已存在"等错误
                    err_str = str(e).lower()
                    if 'already exists' not in err_str and 'duplicate' not in err_str:
                        print(f"⚠️ DDL执行警告: {e}")
        conn.commit()
    
    print("✅ 数据库初始化完成")
