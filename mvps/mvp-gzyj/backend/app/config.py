"""应用配置管理"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置类"""
    database_url: str
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    rule_engine_interval_seconds: int = 60
    db_max_size_gb: float = 1.0
    
    class Config:
        env_file = ".env"


settings = Settings()
