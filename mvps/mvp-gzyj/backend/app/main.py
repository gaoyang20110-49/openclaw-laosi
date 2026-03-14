"""FastAPI 应用入口"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_database
from app.routers import (
    import_data,
    valves,
    timeseries,
    dashboard,
    rules,
    alerts,
    settings as settings_router
)

app = FastAPI(
    title="IDC机房旁通阀异动故障预警工具",
    description="IDC Bypass Valve Alert System",
    version="1.1.0"
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from app.scheduler import scheduler


@app.on_event("startup")
async def startup_event():
    """应用启动时初始化"""
    init_database()
    scheduler.start()


@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时清理"""
    scheduler.shutdown()


# 注册路由
app.include_router(import_data.router)
app.include_router(valves.router)
app.include_router(timeseries.router)
app.include_router(dashboard.router)
app.include_router(rules.router)
app.include_router(alerts.router)
app.include_router(settings_router.router)


@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {"status": "ok"}


@app.get("/")
async def root():
    """根路由"""
    return {
        "message": "IDC机房旁通阀异动故障预警工具 API",
        "version": "1.1.0",
        "docs": "/docs"
    }
