# PLAN.md — IDC机房旁通阀异动故障预警工具

**版本**：v1.0 
**上游文档**：PRD v1.5 / TDD v1.1 
**生成日期**：2026-03-13 
**用途**：AI Agent 可直接执行的开发规格文档，包含 DDL、API 定义、规则引擎伪代码、目录结构与验收标准 
**标注说明**：`【推导补全】` 表示原文档未明确定义、由本文档根据上下文推导，执行前请确认

---

## 目录

1. [项目目录结构](#1-项目目录结构)
2. [环境变量规范](#2-环境变量规范)
3. [数据库 DDL](#3-数据库-ddl)
4. [API 接口定义](#4-api-接口定义)
5. [规则引擎伪代码](#5-规则引擎伪代码)
6. [任务看板](#6-任务看板)

---

## 1. 项目目录结构

```
idc-bypass-alert/
├── backend/
│ ├── app/
│ │ ├── __init__.py
│ │ ├── main.py # FastAPI 入口，注册所有 router
│ │ ├── config.py # 读取环境变量，暴露 Settings 对象
│ │ ├── database.py # SQLAlchemy engine / session 工厂
│ │ ├── models/
│ │ │ ├── __init__.py
│ │ │ ├── valve.py # ValveRegistry ORM
│ │ │ ├── timeseries.py # TimeseriesData ORM
│ │ │ ├── alert_rule.py # AlertRule ORM
│ │ │ ├── alert_incident.py # AlertIncident ORM
│ │ │ ├── alert_event_log.py # AlertEventLog ORM
│ │ │ ├── alert_record.py # AlertRecord ORM
│ │ │ ├── import_log.py # ImportLog ORM
│ │ │ └── system_setting.py # SystemSetting ORM
│ │ ├── schemas/
│ │ │ ├── __init__.py
│ │ │ ├── valve.py # Pydantic schemas for valve
│ │ │ ├── timeseries.py # Pydantic schemas for timeseries
│ │ │ ├── alert_rule.py # Pydantic schemas for rules
│ │ │ ├── alert_incident.py # Pydantic schemas for incidents
│ │ │ └── import_log.py # Pydantic schemas for import
│ │ ├── routers/
│ │ │ ├── __init__.py
│ │ │ ├── import_data.py # POST /api/import/*
│ │ │ ├── valves.py # GET/PATCH /api/valves/*
│ │ │ ├── timeseries.py # GET /api/timeseries/*
│ │ │ ├── rules.py # CRUD /api/rules/*
│ │ │ ├── alerts.py # GET /api/alerts/*
│ │ │ └── settings.py # GET/POST /api/settings/*
│ │ ├── services/
│ │ │ ├── __init__.py
│ │ │ ├── import_service.py # Excel/CSV 解析、校验、UPSERT
│ │ │ ├── rule_engine.py # 规则引擎核心（场景A/B判定）
│ │ │ ├── alert_service.py # 事件归并、incident 管理
│ │ │ └── time_service.py # effective_now() 双模式
│ │ └── scheduler.py # APScheduler 定时任务注册
│ ├── migrations/
│ │ └── init.sql # 完整 DDL（见第3节）
│ ├── tests/
│ │ ├── test_rule_engine.py
│ │ ├── test_import_service.py
│ │ └── test_alert_service.py
│ ├── requirements.txt
│ └── Dockerfile
├── frontend/
│ ├── src/
│ │ ├── main.tsx
│ │ ├── App.tsx # 路由注册
│ │ ├── api/
│ │ │ └── client.ts # axios 实例 + 统一错误处理
│ │ ├── pages/
│ │ │ ├── Dashboard.tsx # 监控看板
│ │ │ ├── Import.tsx # 数据导入+查看
│ │ │ ├── AlertCenter.tsx # 预警中心（双Tab）
│ │ │ ├── RuleConfig.tsx # 预警规则配置
│ │ │ └── History.tsx # 历史数据查询
│ │ ├── components/
│ │ │ ├── layout/
│ │ │ │ ├── Sidebar.tsx
│ │ │ │ └── TopBar.tsx
│ │ │ ├── dashboard/
│ │ │ │ ├── SiteSelector.tsx
│ │ │ │ ├── ValveCard.tsx
│ │ │ │ └── PVGauge.tsx
│ │ │ ├── import/
│ │ │ │ ├── UploadZone.tsx
│ │ │ │ ├── ImportResult.tsx
│ │ │ │ └── ValveTable.tsx
│ │ │ ├── alert/
│ │ │ │ ├── IncidentList.tsx
│ │ │ │ ├── IncidentDetail.tsx
│ │ │ │ └── RecordList.tsx
│ │ │ ├── rule/
│ │ │ │ ├── RuleForm.tsx
│ │ │ │ └── RuleList.tsx
│ │ │ └── history/
│ │ │ ├── QueryForm.tsx
│ │ │ └── PVChart.tsx
│ │ ├── hooks/
│ │ │ ├── useValves.ts
│ │ │ ├── useAlerts.ts
│ │ │ └── useTimeseries.ts
│ │ ├── store/
│ │ │ └── settingsStore.ts # 时间模式全局状态（Zustand）【推导补全】
│ │ └── types/
│ │ └── index.ts # 全局 TypeScript 类型定义
│ ├── public/
│ ├── index.html
│ ├── package.json
│ ├── tsconfig.json
│ ├── tailwind.config.js
│ └── Dockerfile
├── nginx/
│ └── nginx.conf
├── docker-compose.yml
├── .env.example
├── AGENT.md
├── PLAN.md
└── HANDOFF.md
```

---

## 2. 环境变量规范

所有环境变量在 `.env` 文件中定义，`.env.example` 提交到 Git，`.env` 加入 `.gitignore`。

```env
# ── 数据库 ──────────────────────────────────────
DATABASE_URL=postgresql://postgres:password@localhost:5432/idc_bypass
# Docker Compose 内部通信时使用 service name：
# DATABASE_URL=postgresql://postgres:password@db:5432/idc_bypass

# ── 后端服务 ─────────────────────────────────────
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:3000,http://localhost:80

# ── 调度器 ───────────────────────────────────────
RULE_ENGINE_INTERVAL_SECONDS=60 # 规则引擎轮询间隔，默认60秒

# ── 存储上限 ─────────────────────────────────────
DB_MAX_SIZE_GB=1 # MVP固定上限1GB，超限时写入拒绝并告警【推导补全】

# ── 前端 ─────────────────────────────────────────
VITE_API_BASE_URL=http://localhost:8000
```

**后端读取方式（`config.py`）：**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
 database_url: str
 backend_host: str = "0.0.0.0"
 backend_port: int = 8000
 cors_origins: str = "http://localhost:3000"
 rule_engine_interval_seconds: int = 60
 db_max_size_gb: float = 1.0

 class Config:
 env_file = ".env"

settings = Settings()
```

---

## 3. 数据库 DDL

文件路径：`backend/migrations/init.sql` 
执行方式：应用启动时由 `database.py` 检测并自动执行（`CREATE TABLE IF NOT EXISTS`）

```sql
-- ============================================================
-- 1. 阀门主数据（SSOT）
-- ============================================================
CREATE TABLE IF NOT EXISTS valve_registry (
 id SERIAL PRIMARY KEY,
 site_code VARCHAR(50) NOT NULL, -- 机房代码，如 "IDC-A"
 valve_id VARCHAR(100) NOT NULL, -- 阀门编号，如 "BV-01"
 valve_name VARCHAR(200), -- 阀门名称
 valve_type VARCHAR(50) NOT NULL, -- 阀门类型：bypass / chilled / condenser
 location VARCHAR(200), -- 安装位置描述
 is_important BOOLEAN NOT NULL DEFAULT FALSE, -- 重要性标记（唯一来源）
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT uq_site_valve UNIQUE (site_code, valve_id)
);

-- ============================================================
-- 2. 时序数据
-- ============================================================
CREATE TABLE IF NOT EXISTS timeseries_data (
 id BIGSERIAL PRIMARY KEY,
 site_code VARCHAR(50) NOT NULL,
 valve_id VARCHAR(100) NOT NULL,
 timestamp TIMESTAMPTZ NOT NULL, -- 数据采集时间（规则引擎判定基准）
 pv NUMERIC(6,2) NOT NULL, -- 阀门开度反馈值（0.00~100.00）
 source VARCHAR(20) NOT NULL DEFAULT 'import', -- import / api
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT uq_timeseries UNIQUE (site_code, valve_id, timestamp),
 CONSTRAINT fk_timeseries_valve
 FOREIGN KEY (site_code, valve_id)
 REFERENCES valve_registry (site_code, valve_id)
 ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_timeseries_site_valve_ts
 ON timeseries_data (site_code, valve_id, timestamp DESC);

-- ============================================================
-- 3. 预警规则
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_rules (
 id SERIAL PRIMARY KEY,
 rule_name VARCHAR(200) NOT NULL,
 site_code VARCHAR(50), -- NULL = 全机房通用
 valve_type VARCHAR(50), -- NULL = 全阀门类型通用
 scenario VARCHAR(10) NOT NULL, -- 'A' 或 'B'
 -- 场景A参数
 pv_threshold NUMERIC(6,2), -- 开度阈值（%）
 consecutive_points INTEGER, -- 连续点数 N
 consecutive_minutes INTEGER, -- 连续分钟数 M
 -- 场景B参数
 window_minutes INTEGER, -- 滑动窗口（分钟）
 trigger_count INTEGER, -- 窗口内触发次数 K
 -- 公共参数
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. 预警事件（归并后的事件实体）
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_incidents (
 id SERIAL PRIMARY KEY,
 rule_id INTEGER NOT NULL REFERENCES alert_rules(id),
 site_code VARCHAR(50) NOT NULL,
 valve_id VARCHAR(100) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'active',
 -- active / resolved
 triggered_at TIMESTAMPTZ NOT NULL, -- 首次触发时间
 resolved_at TIMESTAMPTZ, -- 恢复时间（NULL=未恢复）
 last_triggered TIMESTAMPTZ NOT NULL, -- 最近一次触发时间
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT fk_incident_valve
 FOREIGN KEY (site_code, valve_id)
 REFERENCES valve_registry (site_code, valve_id)
);
CREATE INDEX IF NOT EXISTS idx_incidents_active
 ON alert_incidents (status, site_code, valve_id);

-- ============================================================
-- 5. 事件日志（每次规则命中追加一条）
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_event_logs (
 id BIGSERIAL PRIMARY KEY,
 incident_id INTEGER NOT NULL REFERENCES alert_incidents(id) ON DELETE CASCADE,
 log_type VARCHAR(20) NOT NULL, -- triggered / ongoing / resolved
 pv_snapshot NUMERIC(6,2), -- 触发时 PV 值快照
 logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. 告警记录（用户可见的通知记录，每次 triggered/resolved 写一条）
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_records (
 id BIGSERIAL PRIMARY KEY,
 incident_id INTEGER NOT NULL REFERENCES alert_incidents(id),
 record_type VARCHAR(20) NOT NULL, -- triggered / resolved
 message TEXT NOT NULL,
 is_read BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. 导入日志
-- ============================================================
CREATE TABLE IF NOT EXISTS import_logs (
 id SERIAL PRIMARY KEY,
 file_name VARCHAR(500) NOT NULL,
 site_code VARCHAR(50) NOT NULL,
 import_type VARCHAR(20) NOT NULL, -- valve_registry / timeseries
 total_rows INTEGER NOT NULL DEFAULT 0,
 success_rows INTEGER NOT NULL DEFAULT 0,
 failed_rows INTEGER NOT NULL DEFAULT 0,
 error_detail JSONB, -- [{row: 3, error: "字段缺失"}]
 status VARCHAR(20) NOT NULL DEFAULT 'pending',
 -- pending / success / partial / failed
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. 系统设置
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
 key VARCHAR(100) PRIMARY KEY,
 value TEXT NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 初始化时间模式设置
INSERT INTO system_settings (key, value)
VALUES ('time_mode', 'realtime') -- realtime / debug
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value)
VALUES ('debug_time', '') -- ISO8601 字符串，time_mode=debug 时生效
ON CONFLICT (key) DO NOTHING;
```

---

## 4. API 接口定义

**Base URL**：`/api` 
**Content-Type**：`application/json`（文件上传接口除外） 
**错误响应统一格式**：
```json
{ "code": 400, "message": "错误描述", "detail": {} }
```

---

### 4.1 数据导入

#### `POST /api/import/valve-registry`
导入阀门主数据（Excel / CSV），执行 UPSERT。

**Request**：`multipart/form-data`
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | ✅ | .xlsx / .csv |
| site_code | string | ✅ | 目标机房代码 |

**Excel 列映射**（列名不区分大小写）：
| Excel列名 | 数据库字段 | 必填 |
|-----------|-----------|------|
| valve_id / 阀门编号 | valve_id | ✅ |
| valve_name / 阀门名称 | valve_name | ❌ |
| valve_type / 阀门类型 | valve_type | ✅ |
| location / 位置 | location | ❌ |
| is_important / 重要 | is_important | ❌（默认false）|

**Response 200**：
```json
{
 "import_log_id": 1,
 "total_rows": 20,
 "success_rows": 18,
 "failed_rows": 2,
 "status": "partial",
 "errors": [
 { "row": 3, "error": "valve_type 字段缺失" },
 { "row": 9, "error": "valve_type 值非法，允许值：bypass/chilled/condenser" }
 ]
}
```

---

#### `POST /api/import/timeseries`
导入时序数据（PV历史数据），执行 UPSERT。

**Request**：`multipart/form-data`
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | ✅ | .xlsx / .csv |
| site_code | string | ✅ | 目标机房代码 |

**Excel 列映射**：
| Excel列名 | 数据库字段 | 必填 |
|-----------|-----------|------|
| valve_id / 阀门编号 | valve_id | ✅ |
| timestamp / 时间 | timestamp | ✅（ISO8601 或 YYYY-MM-DD HH:MM:SS）|
| pv / 开度 | pv | ✅（0~100数值）|

**Response 200**：同上格式

---

#### `GET /api/import/logs`
获取导入历史记录。

**Query Params**：
| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页条数 |
| import_type | string | - | 筛选：valve_registry / timeseries |

**Response 200**：
```json
{
 "total": 50,
 "page": 1,
 "page_size": 20,
 "items": [
 {
 "id": 1,
 "file_name": "valves_idc_a.xlsx",
 "site_code": "IDC-A",
 "import_type": "valve_registry",
 "total_rows": 20,
 "success_rows": 18,
 "failed_rows": 2,
 "status": "partial",
 "created_at": "2026-03-13T10:00:00Z"
 }
 ]
}
```

---

### 4.2 阀门管理

#### `GET /api/valves`
获取阀门列表。

**Query Params**：
| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| site_code | string | - | 按机房筛选 |
| valve_type | string | - | 按类型筛选 |
| is_important | bool | - | 按重要性筛选 |
| page | int | 1 | 页码 |
| page_size | int | 50 | 每页条数 |

**Response 200**：
```json
{
 "total": 100,
 "items": [
 {
 "id": 1,
 "site_code": "IDC-A",
 "valve_id": "BV-01",
 "valve_name": "旁通阀1号",
 "valve_type": "bypass",
 "location": "A栋1层",
 "is_important": true,
 "updated_at": "2026-03-13T10:00:00Z"
 }
 ]
}
```

---

#### `PATCH /api/valves/{site_code}/{valve_id}/importance`
手动切换阀门重要性标记。

**Request Body**：
```json
{ "is_important": true }
```

**Response 200**：
```json
{
 "site_code": "IDC-A",
 "valve_id": "BV-01",
 "is_important": true,
 "updated_at": "2026-03-13T10:00:00Z"
}
```

---

#### `GET /api/valves/sites`
获取所有机房代码列表（用于前端下拉选择）。【推导补全】

**Response 200**：
```json
{ "sites": ["IDC-A", "IDC-B", "IDC-C"] }
```

---

### 4.3 时序数据

#### `GET /api/timeseries/latest`
获取指定机房所有阀门的最新 PV 值（监控看板用）。

**Query Params**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| site_code | string | ✅ | 机房代码 |

**Response 200**：
```json
{
 "site_code": "IDC-A",
 "effective_time": "2026-03-13T10:00:00Z",
 "valves": [
 {
 "valve_id": "BV-01",
 "valve_name": "旁通阀1号",
 "valve_type": "bypass",
 "is_important": true,
 "pv": 35.50,
 "timestamp": "2026-03-13T09:59:00Z"
 }
 ]
}
```

---

#### `GET /api/timeseries/history`
获取指定阀门的历史 PV 曲线数据。

**Query Params**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| site_code | string | ✅ | 机房代码 |
| valve_id | string | ✅ | 阀门编号 |
| start_time | string | ✅ | ISO8601 开始时间 |
| end_time | string | ✅ | ISO8601 结束时间 |

**Response 200**：
```json
{
 "site_code": "IDC-A",
 "valve_id": "BV-01",
 "valve_name": "旁通阀1号",
 "data": [
 { "timestamp": "2026-03-13T09:00:00Z", "pv": 0.0 },
 { "timestamp": "2026-03-13T09:01:00Z", "pv": 12.5 }
 ]
}
```

---

### 4.4 预警规则

#### `GET /api/rules`
获取规则列表。

**Query Params**：
| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| site_code | string | - | 按机房筛选（含通用规则） |
| is_active | bool | - | 按启用状态筛选 |

**Response 200**：
```json
{
 "items": [
 {
 "id": 1,
 "rule_name": "旁通阀异常开启-场景A",
 "site_code": "IDC-A",
 "valve_type": "bypass",
 "scenario": "A",
 "pv_threshold": 5.0,
 "consecutive_points": 3,
 "consecutive_minutes": 3,
 "window_minutes": null,
 "trigger_count": null,
 "is_active": true,
 "created_at": "2026-03-13T10:00:00Z"
 }
 ]
}
```

---

#### `POST /api/rules`
创建预警规则。

**Request Body**：
```json
{
 "rule_name": "旁通阀异常开启-场景A",
 "site_code": "IDC-A",
 "valve_type": "bypass",
 "scenario": "A",
 "pv_threshold": 5.0,
 "consecutive_points": 3,
 "consecutive_minutes": 3,
 "window_minutes": null,
 "trigger_count": null
}
```

**字段校验规则**：
- `scenario = "A"` 时：`pv_threshold`、`consecutive_points`、`consecutive_minutes` 均必填
- `scenario = "B"` 时：`pv_threshold`、`window_minutes`、`trigger_count` 均必填
- `site_code` 和 `valve_type` 均可为 `null`（表示通用规则）

**Response 201**：返回创建后的完整规则对象（同 GET 单条格式）

---

#### `PATCH /api/rules/{rule_id}`
更新规则参数（仅允许修改参数值，不允许修改 scenario / site_code / valve_type）。【推导补全】

**Request Body**（场景A示例）：
```json
{
 "rule_name": "旁通阀异常开启-场景A-修订",
 "pv_threshold": 8.0,
 "consecutive_points": 5,
 "consecutive_minutes": 5
}
```

**Response 200**：返回更新后的完整规则对象

---

#### `DELETE /api/rules/{rule_id}`
删除规则。

**删除约束**：若该规则存在 `status = 'active'` 的 incident，拒绝删除，返回 409。

**Response 409**：
```json
{
 "code": 409,
 "message": "规则存在活跃事件，无法删除",
 "detail": { "active_incident_count": 3 }
}
```

**Response 200**：
```json
{ "message": "规则已删除", "rule_id": 1 }
```

---

#### `PATCH /api/rules/{rule_id}/toggle`
启用 / 停用规则。【推导补全】

**Request Body**：
```json
{ "is_active": false }
```

**Response 200**：返回更新后的完整规则对象

---

### 4.5 预警中心

#### `GET /api/alerts/incidents`
获取事件列表（事件视图 Tab）。

**Query Params**：
| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| site_code | string | - | 按机房筛选 |
| status | string | - | active / resolved |
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页条数 |

**Response 200**：
```json
{
 "total": 10,
 "items": [
 {
 "id": 1,
 "rule_id": 1,
 "rule_name": "旁通阀异常开启-场景A",
 "site_code": "IDC-A",
 "valve_id": "BV-01",
 "valve_name": "旁通阀1号",
 "is_important": true,
 "status": "active",
 "triggered_at": "2026-03-13T09:00:00Z",
 "resolved_at": null,
 "last_triggered": "2026-03-13T09:05:00Z",
 "duration_minutes": 5
 }
 ]
}
```

---

#### `GET /api/alerts/incidents/{incident_id}`
获取事件详情（含完整事件日志）。

**Response 200**：
```json
{
 "id": 1,
 "rule_id": 1,
 "rule_name": "旁通阀异常开启-场景A",
 "site_code": "IDC-A",
 "valve_id": "BV-01",
 "valve_name": "旁通阀1号",
 "status": "active",
 "triggered_at": "2026-03-13T09:00:00Z",
 "resolved_at": null,
 "last_triggered": "2026-03-13T09:05:00Z",
 "event_logs": [
 { "id": 1, "log_type": "triggered", "pv_snapshot": 35.5, "logged_at": "2026-03-13T09:00:00Z" },
 { "id": 2, "log_type": "ongoing", "pv_snapshot": 38.0, "logged_at": "2026-03-13T09:01:00Z" },
 { "id": 3, "log_type": "ongoing", "pv_snapshot": 40.0, "logged_at": "2026-03-13T09:02:00Z" }
 ]
}
```

---

#### `GET /api/alerts/records`
获取告警记录列表（告警记录 Tab）。

**Query Params**：
| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| site_code | string | - | 按机房筛选 |
| is_read | bool | - | 按已读状态筛选 |
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页条数 |

**Response 200**：
```json
{
 "total": 50,
 "unread_count": 5,
 "items": [
 {
 "id": 1,
 "incident_id": 1,
 "record_type": "triggered",
 "message": "【IDC-A】旁通阀 BV-01 触发预警：场景A，当前开度 35.5%",
 "is_read": false,
 "created_at": "2026-03-13T09:00:00Z"
 }
 ]
}
```

---

#### `PATCH /api/alerts/records/{record_id}/read`
标记告警记录为已读。【推导补全】

**Response 200**：
```json
{ "id": 1, "is_read": true }
```

---

#### `PATCH /api/alerts/records/read-all`
全部标记已读。【推导补全】

**Response 200**：
```json
{ "updated_count": 5 }
```

---

### 4.6 系统设置（时间模式）

#### `GET /api/settings/time-mode`
获取当前时间模式。

**Response 200**：
```json
{
 "time_mode": "realtime",
 "debug_time": null
}
```

---

#### `POST /api/settings/time-mode`
切换时间模式。

**Request Body**：
```json
{
 "time_mode": "debug",
 "debug_time": "2026-03-01T00:00:00Z"
}
```

**校验规则**：
- `time_mode = "debug"` 时，`debug_time` 必填且为合法 ISO8601
- `time_mode = "realtime"` 时，`debug_time` 忽略

**Response 200**：
```json
{
 "time_mode": "debug",
 "debug_time": "2026-03-01T00:00:00Z"
}
```

---

## 5. 规则引擎伪代码

文件路径：`backend/app/services/rule_engine.py`

### 5.1 入口函数（由 APScheduler 每分钟调用）

```python
def run_rule_engine(db: Session) -> None:
 """
 规则引擎主入口，每 RULE_ENGINE_INTERVAL_SECONDS 秒执行一次。
 """
 now = effective_now(db) # 获取当前有效时间（实时 or 调试）
 active_rules = db.query(AlertRule).filter(AlertRule.is_active == True).all()

 for rule in active_rules:
 # 获取该规则覆盖的阀门列表
 valves = get_valves_for_rule(db, rule)
 for valve in valves:
 evaluate_rule(db, rule, valve, now)
```

---

### 5.2 `effective_now()`

```python
def effective_now(db: Session) -> datetime:
 """
 实时模式：返回 datetime.utcnow()
 调试模式：返回 system_settings 中 debug_time 的值
 """
 mode_setting = db.query(SystemSetting).filter_by(key='time_mode').first()
 if mode_setting and mode_setting.value == 'debug':
 debug_time_str = db.query(SystemSetting).filter_by(key='debug_time').first()
 if debug_time_str and debug_time_str.value:
 return datetime.fromisoformat(debug_time_str.value)
 return datetime.utcnow()
```

---

### 5.3 `get_valves_for_rule()`

```python
def get_valves_for_rule(db: Session, rule: AlertRule) -> List[ValveRegistry]:
 """
 规则的 site_code / valve_type 均可为 None（通用规则）
 前置判断：site_code 匹配 AND valve_type 匹配
 """
 query = db.query(ValveRegistry)
 if rule.site_code:
 query = query.filter(ValveRegistry.site_code == rule.site_code)
 if rule.valve_type:
 query = query.filter(ValveRegistry.valve_type == rule.valve_type)
 return query.all()
```

---

### 5.4 场景 A 判定

**触发条件**：连续 N 点 PV > threshold AND 这 N 点的时间跨度 ≥ M 分钟（双条件同时满足）

```python
def evaluate_scenario_a(
 db: Session,
 rule: AlertRule,
 valve: ValveRegistry,
 now: datetime
) -> bool:
 """
 场景A：连续N点 AND 连续N分钟（v1.1 修订：AND 非 OR）
 判定时间轴：使用数据的 timestamp 字段
 """
 N = rule.consecutive_points # 连续点数
 M = rule.consecutive_minutes # 连续分钟数
 threshold = rule.pv_threshold # 开度阈值

 # 取最近 N 条数据（按 timestamp 降序）
 recent_data = (
 db.query(TimeseriesData)
 .filter(
 TimeseriesData.site_code == valve.site_code,
 TimeseriesData.valve_id == valve.valve_id,
 TimeseriesData.timestamp <= now
 )
 .order_by(TimeseriesData.timestamp.desc())
 .limit(N)
 .all()
 )

 # 条件1：必须恰好有 N 条数据
 if len(recent_data) < N:
 return False

 # 条件2：N 条数据全部 PV > threshold
 if not all(d.pv > threshold for d in recent_data):
 return False

 # 条件3：最早一条与最新一条的时间差 >= M 分钟
 latest_ts = recent_data[0].timestamp # 降序第一条 = 最新
 earliest_ts = recent_data[-1].timestamp # 降序最后一条 = 最早
 span_minutes = (latest_ts - earliest_ts).total_seconds() / 60

 if span_minutes < M:
 return False

 return True
```

---

### 5.5 场景 B 判定

**触发条件**：在过去 W 分钟窗口内，PV > threshold 的数据点出现次数 ≥ K 次（允许跨断点，非连续）

```python
def evaluate_scenario_b(
 db: Session,
 rule: AlertRule,
 valve: ValveRegistry,
 now: datetime
) -> bool:
 """
 场景B：滑动窗口内非连续点计数（v1.1 修订：允许跨断点）
 判定时间轴：使用数据的 timestamp 字段
 """
 W = rule.window_minutes # 滑动窗口分钟数
 K = rule.trigger_count # 窗口内触发次数
 threshold = rule.pv_threshold # 开度阈值

 window_start = now - timedelta(minutes=W)

 # 取窗口内所有数据
 window_data = (
 db.query(TimeseriesData)
 .filter(
 TimeseriesData.site_code == valve.site_code,
 TimeseriesData.valve_id == valve.valve_id,
 TimeseriesData.timestamp >= window_start,
 TimeseriesData.timestamp <= now
 )
 .all()
 )

 # 统计 PV > threshold 的点数
 hit_count = sum(1 for d in window_data if d.pv > threshold)

 return hit_count >= K
```

---

### 5.6 事件归并主流程

```python
def evaluate_rule(
 db: Session,
 rule: AlertRule,
 valve: ValveRegistry,
 now: datetime
) -> None:
 """
 规则命中后的事件归并逻辑：
 - 存在 active incident → 追加 ongoing 日志，更新 last_triggered
 - 不存在 active incident → 创建新 incident，写入 triggered 日志，写入 alert_record
 - 规则未命中但存在 active incident → 恢复事件，写入 resolved 日志，写入 alert_record
 """
 # 1. 执行判定
 if rule.scenario == 'A':
 is_triggered = evaluate_scenario_a(db, rule, valve, now)
 elif rule.scenario == 'B':
 is_triggered = evaluate_scenario_b(db, rule, valve, now)
 else:
 return

 # 2. 查找当前 active incident
 active_incident = (
 db.query(AlertIncident)
 .filter(
 AlertIncident.rule_id == rule.id,
 AlertIncident.site_code == valve.site_code,
 AlertIncident.valve_id == valve.valve_id,
 AlertIncident.status == 'active'
 )
 .first()
 )

 # 3. 获取当前 PV 快照
 latest_data = (
 db.query(TimeseriesData)
 .filter(
 TimeseriesData.site_code == valve.site_code,
 TimeseriesData.valve_id == valve.valve_id,
 TimeseriesData.timestamp <= now
 )
 .order_by(TimeseriesData.timestamp.desc())
 .first()
 )
 pv_snapshot = latest_data.pv if latest_data else None

 if is_triggered:
 if active_incident:
 # ── 已有活跃事件：追加 ongoing 日志，更新 last_triggered ──
 log = AlertEventLog(
 incident_id=active_incident.id,
 log_type='ongoing',
 pv_snapshot=pv_snapshot,
 logged_at=now
 )
 db.add(log)
 active_incident.last_triggered = now
 else:
 # ── 新事件：创建 incident + triggered 日志 + alert_record ──
 incident = AlertIncident(
 rule_id=rule.id,
 site_code=valve.site_code,
 valve_id=valve.valve_id,
 status='active',
 triggered_at=now,
 last_triggered=now
 )
 db.add(incident)
 db.flush() # 获取 incident.id

 log = AlertEventLog(
 incident_id=incident.id,
 log_type='triggered',
 pv_snapshot=pv_snapshot,
 logged_at=now
 )
 db.add(log)

 record = AlertRecord(
 incident_id=incident.id,
 record_type='triggered',
 message=build_alert_message('triggered', rule, valve, pv_snapshot),
 is_read=False,
 created_at=now
 )
 db.add(record)

 else:
 if active_incident:
 # ── 规则不再命中：恢复事件 ──
 active_incident.status = 'resolved'
 active_incident.resolved_at = now

 log = AlertEventLog(
 incident_id=active_incident.id,
 log_type='resolved',
 pv_snapshot=pv_snapshot,
 logged_at=now
 )
 db.add(log)

 record = AlertRecord(
 incident_id=active_incident.id,
 record_type='resolved',
 message=build_alert_message('resolved', rule, valve, pv_snapshot),
 is_read=False,
 created_at=now
 )
 db.add(record)

 db.commit()


def build_alert_message(
 record_type: str,
 rule: AlertRule,
 valve: ValveRegistry,
 pv_snapshot: float
) -> str:
 """生成告警通知文本"""
 valve_name = valve.valve_name or valve.valve_id
 if record_type == 'triggered':
 return (
 f"【{valve.site_code}】{valve_name} 触发预警：{rule.rule_name}，"
 f"当前开度 {pv_snapshot}%"
 )
 elif record_type == 'resolved':
 return (
 f"【{valve.site_code}】{valve_name} 预警恢复：{rule.rule_name}，"
 f"当前开度 {pv_snapshot}%"
 )
 return ""
```

---

## 6. 任务看板

### 任务状态说明
- `[ ]` 未开始
- `[→]` 进行中
- `[x]` 已完成

---

### PHASE 0：项目初始化

#### T0-1 项目脚手架搭建
- **状态**：`[ ]`
- **目标**：建立完整目录结构，确保前后端可独立启动
- **执行步骤**：
 1. 按第1节目录结构创建所有文件夹和空文件
 2. 初始化后端：`pip install fastapi uvicorn sqlalchemy psycopg2-binary pandas openpyxl pydantic-settings apscheduler`，生成 `requirements.txt`
 3. 初始化前端：`npm create vite@latest frontend -- --template react-ts`，安装 `tailwindcss recharts axios zustand`
 4. 创建 `.env` 文件（参考第2节）
 5. 编写 `docker-compose.yml`（含 db / backend / frontend / nginx 四个服务）
- **验收标准**：
 - `docker-compose up` 后四个服务均健康
 - `GET http://localhost:8000/health` 返回 `{"status": "ok"}`
 - `http://localhost:3000` 可访问前端空白页

---

#### T0-2 数据库初始化
- **状态**：`[ ]`
- **目标**：执行 DDL，建立所有表结构
- **执行步骤**：
 1. 将第3节完整 DDL 写入 `backend/migrations/init.sql`
 2. 在 `backend/app/database.py` 中实现启动时自动执行 `init.sql`
 3. 实现 SQLAlchemy ORM 模型（`backend/app/models/` 下所有文件）
- **验收标准**：
 - 应用启动后，PostgreSQL 中存在全部8张表
 - `system_settings` 表中有 `time_mode=realtime` 和 `debug_time=''` 两条初始记录
 - ORM 模型可正常 CRUD（单元测试通过）

---

### PHASE 1：数据导入

#### T1-1 后端导入服务
- **状态**：`[ ]`
- **目标**：实现 Excel/CSV 解析、字段校验、UPSERT 逻辑
- **文件**：`backend/app/services/import_service.py` + `backend/app/routers/import_data.py`
- **执行步骤**：
 1. 实现 `parse_valve_registry_file(file, site_code)` → 返回 `(valid_rows, error_rows)`
 2. 实现 `parse_timeseries_file(file, site_code)` → 返回 `(valid_rows, error_rows)`
 3. 字段校验规则（见4.1节 Excel 列映射）
 4. UPSERT 逻辑：`INSERT INTO ... ON CONFLICT (site_code, valve_id) DO UPDATE SET ...`
 5. 写入 `import_logs` 记录
 6. 注册路由：`POST /api/import/valve-registry` 和 `POST /api/import/timeseries`
 7. 注册路由：`GET /api/import/logs`
- **验收标准**：
 - 上传合法 Excel 文件，返回 `status: success`，数据库中可查到导入数据
 - 上传含错误行的文件，返回 `status: partial`，`errors` 数组包含行号和错误原因
 - 上传完全非法文件，返回 `status: failed`
 - 重复导入同一 valve_id，数据更新而非新增（UPSERT 验证）
 - `GET /api/import/logs` 返回历史记录

---

#### T1-2 前端导入页面
- **状态**：`[ ]`
- **目标**：实现数据导入入口 + 导入结果展示 + 阀门数据查看
- **文件**：`frontend/src/pages/Import.tsx` + `frontend/src/components/import/`
- **页面规格**：
 - **上半部分（导入区）**：
 - 机房选择下拉（调用 `GET /api/valves/sites`）
 - 导入类型选择：阀门主数据 / 时序数据
 - 拖拽上传区域（支持 .xlsx / .csv）
 - 上传后展示导入结果：成功N条、失败N条、错误明细表格（行号+原因）
 - **下半部分（数据查看区）**：
 - 阀门列表表格，列：机房、阀门编号、阀门名称、类型、位置、重要性（可切换开关）
 - 支持按机房/类型筛选
 - 重要性开关调用 `PATCH /api/valves/{site_code}/{valve_id}/importance`
- **验收标准**：
 - 可完成文件上传并展示结果
 - 错误明细可展开查看
 - 重要性开关切换后，刷新页面状态保持
 - 阀门列表分页正常

---

### PHASE 2：监控看板

#### T2-1 后端看板 API
- **状态**：`[ ]`
- **目标**：实现最新 PV 查询接口
- **文件**：`backend/app/routers/timeseries.py` + `backend/app/routers/valves.py`
- **执行步骤**：
 1. 实现 `GET /api/timeseries/latest?site_code=xxx`（见4.3节）
 2. 实现 `GET /api/valves/sites`（见4.2节）
- **验收标准**：
 - 有时序数据时，接口返回每个阀门的最新 PV 值和时间戳
 - 无时序数据时，返回空 `valves` 数组，不报错
 - `effective_time` 字段反映当前时间模式（实时/调试）

---

#### T2-2 前端监控看板
- **状态**：`[ ]`
- **目标**：实现机房切换 + 阀门 PV 实时展示
- **文件**：`frontend/src/pages/Dashboard.tsx` + `frontend/src/components/dashboard/`
- **页面规格**：
 - 顶部：机房切换 Tab 或下拉（调用 `GET /api/valves/sites`）
 - 主体：阀门卡片网格布局
 - 每张卡片展示：阀门名称、阀门编号、类型、PV 值（大字体）、数据时间戳
 - 重要阀门卡片高亮显示（边框或背景色区分）
 - PV > 5% 时卡片显示警示色（黄色）【推导补全，阈值可配置】
 - 每30秒自动刷新（轮询）【推导补全】
- **验收标准**：
 - 切换机房后，卡片列表更新
 - 重要阀门视觉区分明显
 - 30秒自动刷新，PV 值更新

---

### PHASE 3：预警规则配置

#### T3-1 后端规则 CRUD
- **状态**：`[ ]`
- **目标**：实现规则的增删改查及删除约束
- **文件**：`backend/app/routers/rules.py`
- **执行步骤**：
 1. 实现 `GET /api/rules`
 2. 实现 `POST /api/rules`（含字段校验，见4.4节）
 3. 实现 `PATCH /api/rules/{rule_id}`
 4. 实现 `DELETE /api/rules/{rule_id}`（含活跃事件约束，返回409）
 5. 实现 `PATCH /api/rules/{rule_id}/toggle`
- **验收标准**：
 - 场景A规则缺少 `consecutive_points` 时，POST 返回 422
 - 删除有活跃 incident 的规则，返回 409
 - 删除无活跃 incident 的规则，返回 200，数据库中规则消失

---

#### T3-2 前端规则配置页面
- **状态**：`[ ]`
- **目标**：实现规则列表展示 + 新建规则表单
- **文件**：`frontend/src/pages/RuleConfig.tsx` + `frontend/src/components/rule/`
- **页面规格**：
 - **规则列表**：
 - 列：规则名称、机房、阀门类型、场景、关键参数摘要、状态（启用/停用开关）、操作（编辑/删除）
 - 删除时若返回409，展示提示："该规则存在活跃事件，请先处理后再删除"
 - **新建/编辑规则表单（侧边抽屉或弹窗）**：
 - 规则名称（文本输入）
 - 机房（下拉，含"全部机房"选项）
 - 阀门类型（下拉：bypass / chilled / condenser / 全部类型）
 - 场景选择（A / B 单选，切换后表单字段动态变化）
 - 场景A字段：开度阈值(%) / 连续点数 / 连续分钟数
 - 场景B字段：开度阈值(%) / 窗口分钟数 / 触发次数
- **验收标准**：
 - 场景切换后，表单字段正确显示/隐藏
 - 提交缺失必填字段时，前端校验拦截并提示
 - 新建规则后，列表刷新显示新规则

---

### PHASE 4：规则引擎

#### T4-1 规则引擎核心实现
- **状态**：`[ ]`
- **目标**：实现场景A/B判定 + 事件归并 + APScheduler 调度
- **文件**：`backend/app/services/rule_engine.py` + `backend/app/services/alert_service.py` + `backend/app/services/time_service.py` + `backend/app/scheduler.py`
- **执行步骤**：
 1. 实现 `time_service.py`：`effective_now(db)` 函数（见5.2节）
 2. 实现 `rule_engine.py`：`evaluate_scenario_a()` / `evaluate_scenario_b()` / `get_valves_for_rule()` / `run_rule_engine()`（见5.1~5.5节）
 3. 实现 `alert_service.py`：`evaluate_rule()` / `build_alert_message()`（见5.6节）
 4. 在 `scheduler.py` 中注册 APScheduler，每 `RULE_ENGINE_INTERVAL_SECONDS` 秒调用 `run_rule_engine()`
 5. 在 `main.py` 的 `startup` 事件中启动调度器
- **验收标准**：
 - 写入满足场景A条件的时序数据，等待下一轮调度后，`alert_incidents` 表中出现新 incident
 - 同一 incident 连续触发，`alert_event_logs` 追加 `ongoing` 记录，不新建 incident
 - 条件解除后，incident 状态变为 `resolved`，`alert_records` 中出现 `resolved` 记录
 - 调试模式下，`effective_now()` 返回 `debug_time` 而非当前时间

---

#### T4-2 时间模式 API + 前端切换
- **状态**：`[ ]`
- **目标**：实现实时/调试双模式切换
- **文件**：`backend/app/routers/settings.py` + 前端 TopBar 组件
- **执行步骤**：
 1. 实现 `GET /api/settings/time-mode`
 2. 实现 `POST /api/settings/time-mode`（含校验，见4.6节）
 3. 前端 TopBar 增加时间模式切换入口：
 - 实时模式：显示"实时"标签 + 当前时间
 - 调试模式：显示"调试"标签 + 日期时间选择器（选择 debug_time）
- **验收标准**：
 - 切换到调试模式并设置 debug_time，规则引擎下一轮使用 debug_time 作为基准时间
 - 切换回实时模式，规则引擎恢复使用 `datetime.utcnow()`
 - 前端 TopBar 正确展示当前模式

---

### PHASE 5：预警中心

#### T5-1 后端预警中心 API
- **状态**：`[ ]`
- **目标**：实现事件列表、事件详情、告警

# UI设计规范 (v2.0)

## 整体设计风格
- **主题**: 深色渐变主题 + 玻璃态效果
- **配色**: 紫色系主色调，配合渐变色
- **视觉**: 现代化卡片设计 + 流畅动画

## 配色方案
- **主色**: 紫色渐变 (from-purple-600 to-blue-600)
- **成功**: 绿色渐变 (from-green-500 to-emerald-500)
- **警告**: 橙红渐变 (from-orange-500 to-red-500)
- **信息**: 蓝青渐变 (from-blue-500 to-cyan-500)

## 组件设计
- **玻璃态卡片**: bg-white/95 backdrop-blur-xl + border-white/20
- **渐变按钮**: bg-gradient-to-r + hover:scale-105
- **状态标签**: px-3 py-1 rounded-full + 渐变背景
- **数据卡片**: data-card + 渐变背景 + 图标装饰

## 动画效果
- fadeInUp: 页面加载动画
- pulse-ring: 呼吸灯效果
- float: 浮动动画
- hover: scale-[1.02] + border-color 变化

