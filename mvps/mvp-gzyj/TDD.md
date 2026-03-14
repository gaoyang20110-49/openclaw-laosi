# TDD：IDC机房旁通阀异动故障预警工具

**文档版本**：v1.1 
**上游文档**：PRD v1.4 / MRD v0.4 / 功能验证清单 v1.0 
**开发方式**：AI自动执行编码（扣子平台 + 豆包大模型） 
**更新日期**：2026-03-13 
**修订说明**：本版本为 v1.0 完整修订版，重点修复规则判定、告警归并、调试时钟、主键设计与数据一致性问题。

---

## 0. 版本修订摘要（v1.1 相对 v1.0）

| # | 修订项 | v1.0 | v1.1 |
|---|--------|------|------|
| 1 | 场景A判定 | 连续N点 OR 连续N分钟 | 同时满足连续N点 AND 连续N分钟 |
| 2 | 场景B判定 | 未明确跨断点行为 | 明确允许跨断点，窗口内非连续点可参与 |
| 3 | 判定时间轴 | 未明确 | 统一使用数据采集时间 `timestamp` |
| 4 | 时间模式 | 无 | 新增实时/调试双模式切换 |
| 5 | 告警去重 | cooldown屏蔽 | 升级为事件归并+持续日志 |
| 6 | 告警表结构 | 单表 `alert_records` | 新增 `alert_incidents` + `alert_event_logs` |
| 7 | 阀门唯一约束 | `valve_id` 单字段 | `UNIQUE(site_code, valve_id)` |
| 8 | 重要性字段SSOT | 两表并存 | 唯一来源：`valve_registry.is_important` |
| 9 | 存储上限 | 未确认 | 1GB（MVP固定上限） |

---

## 1. 技术架构总览

### 1.1 架构分层

| 层次 | 技术选型 |
|------|---------|
| 前端 | React + TypeScript + Tailwind CSS + Recharts |
| 后端 | FastAPI + SQLAlchemy + APScheduler |
| 数据库 | PostgreSQL |
| 部署 | Docker Compose + Nginx |
| AI实现 | 扣子平台 + 豆包大模型 |

### 1.2 核心运行链路

```
用户导入 Excel/CSV
 ↓
字段校验 → 不通过 → 错误报告（行级）
 ↓ 通过
主数据同步（valve_registry UPSERT）
 ↓
时序数据写入（timeseries_data UPSERT）
 ↓
APScheduler 定时触发规则引擎（每分钟）
 ↓
effective_now() → 实时时间 or debug_now
 ↓
规则命中判定（场景A / 场景B）
 ↓
┌─────────────────────┐
│ 查找 active incident │
│ (rule_id+site+valve) │
└─────────────────────┘
 ↓ 存在 ↓ 不存在
追加 ongoing 日志 创建新 incident
更新 last_triggered 写入 triggered 日志
 ↓
前端展示：活跃事件 / 持续轨迹 / 历史曲线
```

---

## 2. 数据库设计（v1.1）

### 2.1 表关系总览

```
valve_registry (SSOT)
 ↑ 关联
timeseries_data
alert_rules
 ↓ 触发
alert_incidents ←→ alert_event_logs
 ↓ 挂载
alert_records
import_logs
system_settings
```

### 2.2 DDL 建表语句

```sql
-- ============================================================
-- 1. 阀门主数据（SSOT）
-- ============================================================
CREATE TABLE valve_registry (
 id BIGSERIAL PRIMARY KEY,
 site_code VARCHAR(50) NOT NULL,
 valve_id VARCHAR(50) NOT NULL,
 valve_type VARCHAR(100) NOT NULL,
 point_name VARCHAR(200),
 point_id VARCHAR(100),
 is_important BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMP NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
 UNIQUE (site_code, valve_id)
);
CREATE INDEX idx_valve_site ON valve_registry(site_code);
CREATE INDEX idx_valve_important ON valve_registry(is_important);

-- ============================================================
-- 2. 时序数据（事实表）
-- ============================================================
CREATE TABLE timeseries_data (
 id BIGSERIAL PRIMARY KEY,
 timestamp TIMESTAMP NOT NULL,
 site_code VARCHAR(50) NOT NULL,
 valve_id VARCHAR(50) NOT NULL,
 valve_type VARCHAR(100),
 point_name VARCHAR(200),
 point_id VARCHAR(100),
 pv_value NUMERIC(6,2) NOT NULL
 CHECK (pv_value >= 0 AND pv_value <= 100),
 data_source VARCHAR(50) NOT NULL DEFAULT 'excel_import',
 created_at TIMESTAMP NOT NULL DEFAULT NOW(),
 UNIQUE (timestamp, site_code, valve_id)
);
CREATE INDEX idx_ts_site_valve_time
 ON timeseries_data(site_code, valve_id, timestamp DESC);
CREATE INDEX idx_ts_time
 ON timeseries_data(timestamp DESC);

-- ============================================================
-- 3. 规则配置
-- ============================================================
CREATE TABLE alert_rules (
 id SERIAL PRIMARY KEY,
 rule_name VARCHAR(100) NOT NULL,
 scene_type VARCHAR(10) NOT NULL
 CHECK (scene_type IN ('A', 'B')),
 site_code VARCHAR(50), -- NULL = 全部机房
 valve_type_filter VARCHAR(100), -- NULL = 不限类型
 importance_filter VARCHAR(20) NOT NULL DEFAULT 'all'
 CHECK (importance_filter IN ('all','important','normal')),
 enabled BOOLEAN NOT NULL DEFAULT TRUE,
 params JSONB NOT NULL,
 -- 场景A params示例：
 -- {"n_points":5,"n_minutes":5,"threshold":80,
 -- "recover_points":2,"recover_minutes":2}
 -- 场景B params示例：
 -- {"window_minutes":10,"delta_threshold":20,
 -- "recover_delta_threshold":16}
 created_at TIMESTAMP NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. 持续告警事件（新增 v1.1）
-- ============================================================
CREATE TABLE alert_incidents (
 id BIGSERIAL PRIMARY KEY,
 rule_id INTEGER NOT NULL REFERENCES alert_rules(id),
 site_code VARCHAR(50) NOT NULL,
 valve_id VARCHAR(50) NOT NULL,
 status VARCHAR(20) NOT NULL
 CHECK (status IN ('active','recovered','closed')),
 first_triggered_at TIMESTAMP NOT NULL,
 last_triggered_at TIMESTAMP NOT NULL,
 ended_at TIMESTAMP,
 trigger_count INTEGER NOT NULL DEFAULT 1,
 current_pv_value NUMERIC(6,2),
 max_delta_value NUMERIC(6,2),
 created_at TIMESTAMP NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_incident_active
 ON alert_incidents(status, updated_at DESC);
CREATE INDEX idx_incident_dim
 ON alert_incidents(rule_id, site_code, valve_id, status);

-- ============================================================
-- 5. 事件过程日志（新增 v1.1）
-- ============================================================
CREATE TABLE alert_event_logs (
 id BIGSERIAL PRIMARY KEY,
 incident_id BIGINT NOT NULL REFERENCES alert_incidents(id),
 event_type VARCHAR(20) NOT NULL
 CHECK (event_type IN ('triggered','ongoing','recovered','closed')),
 event_time TIMESTAMP NOT NULL,
 pv_value NUMERIC(6,2),
 delta_value NUMERIC(6,2),
 window_info JSONB,
 -- 示例：{"points_count":5,"window_start":"...","window_end":"..."}
 created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_event_log_incident
 ON alert_event_logs(incident_id, event_time DESC);

-- ============================================================
-- 6. 告警记录（通知/列表展示）
-- ============================================================
CREATE TABLE alert_records (
 id BIGSERIAL PRIMARY KEY,
 incident_id BIGINT REFERENCES alert_incidents(id),
 rule_id INTEGER NOT NULL REFERENCES alert_rules(id),
 site_code VARCHAR(50) NOT NULL,
 valve_id VARCHAR(50) NOT NULL,
 alert_type VARCHAR(20) NOT NULL
 CHECK (alert_type IN ('triggered','recovered')),
 alert_time TIMESTAMP NOT NULL,
 pv_value NUMERIC(6,2),
 delta_value NUMERIC(6,2),
 is_read BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alert_unread
 ON alert_records(is_read, created_at DESC);
CREATE INDEX idx_alert_site_valve
 ON alert_records(site_code, valve_id, created_at DESC);

-- ============================================================
-- 7. 导入日志
-- ============================================================
CREATE TABLE import_logs (
 id BIGSERIAL PRIMARY KEY,
 batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
 file_name VARCHAR(255) NOT NULL,
 total_rows INTEGER NOT NULL DEFAULT 0,
 success_rows INTEGER NOT NULL DEFAULT 0,
 failed_rows INTEGER NOT NULL DEFAULT 0,
 skipped_rows INTEGER NOT NULL DEFAULT 0,
 status VARCHAR(20) NOT NULL
 CHECK (status IN ('processing','completed','failed','partial')),
 error_detail JSONB,
 -- 示例：[{"row":3,"field":"pv_value","msg":"超出范围"},...]
 started_at TIMESTAMP NOT NULL DEFAULT NOW(),
 completed_at TIMESTAMP
);

-- ============================================================
-- 8. 系统设置（新增 v1.1）
-- ============================================================
CREATE TABLE system_settings (
 key VARCHAR(100) PRIMARY KEY,
 value TEXT NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 初始化时间模式设置
INSERT INTO system_settings(key, value) VALUES
 ('time_mode', 'realtime'),
 ('debug_now', ''),
 ('storage_limit_bytes', '1073741824');
```

---

## 3. 规则判定规范（算法合同）

> ⚠️ 本节为规则引擎的"算法合同"，实现必须严格遵守，不得自行扩展解释。

### 3.1 公共约定

- **时间轴**：所有窗口计算均使用 `timeseries_data.timestamp`（采集时间），不使用 `created_at`（入库时间）
- **当前时间**：统一使用 `effective_now()`，由系统时间模式决定（见第4节）
- **PV值范围**：0.00 ~ 100.00，超出范围的行在导入时拒绝，不参与计算
- **NULL处理**：`pv_value` 为 NULL 的行不参与任何窗口计算

### 3.2 场景A（绝对阈值 + 双条件 AND）

**触发条件（必须同时满足）**：

```
条件1：在 [effective_now - n_minutes, effective_now] 时间窗口内，
 按采集时间排序，存在连续 n_points 个点，
 每个点的 pv_value >= threshold

条件2：上述连续点中，最早点的 timestamp 到最晚点的 timestamp
 时间跨度 >= n_minutes 分钟
```

**参数说明**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `n_points` | int | 连续点数阈值，最小2 |
| `n_minutes` | int | 时间跨度阈值（分钟），最小1 |
| `threshold` | float | PV值触发阈值（0~100） |
| `recover_points` | int | 恢复所需连续低于阈值的点数，默认2 |
| `recover_minutes` | int | 恢复所需时间跨度（分钟），默认2 |

**恢复条件（同样双条件 AND）**：

```
条件1：连续 recover_points 个点 pv_value < threshold
条件2：上述连续点时间跨度 >= recover_minutes 分钟
```

**伪代码**：

```python
def evaluate_scene_a(rule, site_code, valve_id, effective_now):
 params = rule.params
 window_start = effective_now - timedelta(minutes=params['n_minutes'])

 rows = query("""
 SELECT timestamp, pv_value
 FROM timeseries_data
 WHERE site_code = :site AND valve_id = :valve
 AND timestamp BETWEEN :start AND :now
 AND pv_value IS NOT NULL
 ORDER BY timestamp ASC
 """, site=site_code, valve=valve_id, start=window_start, now=effective_now)

 # 找连续满足阈值的点序列
 consecutive = find_consecutive_above(rows, params['threshold'])

 for seq in consecutive:
 if len(seq) >= params['n_points']:
 time_span = (seq[-1].timestamp - seq[0].timestamp).total_seconds() / 60
 if time_span >= params['n_minutes']:
 return True, seq # 触发

 return False, []
```

### 3.3 场景B（变化量 + 允许跨断点）

**触发条件**：

```
在 [effective_now - window_minutes, effective_now] 时间窗口内，
取所有 pv_value 不为 NULL 的点（允许非连续，即跨断点），
计算：max(pv_value) - min(pv_value) >= delta_threshold
```

**参数说明**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `window_minutes` | int | 时间窗口（分钟） |
| `delta_threshold` | float | 变化量触发阈值 |
| `recover_delta_threshold` | float | 恢复阈值，建议设为 delta_threshold × 0.8 |

**恢复条件**：

```
最近 window_minutes 分钟内：
max(pv_value) - min(pv_value) < recover_delta_threshold
```

**伪代码**：

```python
def evaluate_scene_b(rule, site_code, valve_id, effective_now):
 params = rule.params
 window_start = effective_now - timedelta(minutes=params['window_minutes'])

 rows = query("""
 SELECT pv_value
 FROM timeseries_data
 WHERE site_code = :site AND valve_id = :valve
 AND timestamp BETWEEN :start AND :now
 AND pv_value IS NOT NULL
 """, site=site_code, valve=valve_id, start=window_start, now=effective_now)

 if len(rows) < 2:
 return False, {}

 max_pv = max(r.pv_value for r in rows)
 min_pv = min(r.pv_value for r in rows)
 delta = max_pv - min_pv

 if delta >= params['delta_threshold']:
 return True, {"max": max_pv, "min": min_pv, "delta": delta}

 return False, {}
```

---

## 4. 时间模式规范（v1.1 新增）

### 4.1 模式定义

| 模式 | `time_mode` 值 | `effective_now()` 返回值 |
|------|---------------|------------------------|
| 实时模式 | `realtime` | `datetime.utcnow()`（当前时间） |
| 调试模式 | `debug` | `system_settings['debug_now']` 解析后的时间 |

### 4.2 前端入口规范

- **位置**：全局 TopBar 右侧，预警铃铛左侧
- **实时模式显示**：绿色圆点 + `实时模式`
- **调试模式显示**：黄色圆点 + `调试模式：2025-11-28 14:35:00`
- **切换操作**：点击后弹出模态框，选择模式并设置时间点

### 4.3 调试模式约束

- `debug_now` 格式必须为 `YYYY-MM-DD HH:MM:SS`
- `debug_now` 不得晚于当前真实时间（不允许设置未来时间）
- 调试模式下，规则引擎仍按正常频率运行，但窗口计算基于 `debug_now`
- 调试模式下所有告警产生的 incident 标记 `data_source = 'debug'`，不影响生产告警统计

### 4.4 API

```
GET /api/system/time-mode
响应：{ "mode": "realtime" | "debug", "debug_now": "YYYY-MM-DD HH:MM:SS" | null }

PUT /api/system/time-mode
请求体：{ "mode": "realtime" } 或 { "mode": "debug", "debug_now": "2025-11-28 14:35:00" }
响应：{ "success": true, "effective_now": "..." }
```

---

## 5. 告警事件归并模型（v1.1 核心升级）

### 5.1 归并维度（已确认）

```
归并键 = rule_id + site_code + valve_id
```

同一规则对同一阀门的连续命中，归并为一个 `alert_incidents` 记录。 
不同规则对同一阀门的命中，产生独立的 incident。

### 5.2 触发逻辑（状态机）

```
规则引擎命中
 ↓
查询：SELECT * FROM alert_incidents
 WHERE rule_id=:rid AND site_code=:site
 AND valve_id=:valve AND status='active'
 ORDER BY created_at DESC LIMIT 1
 ↓
┌──────────────┬──────────────────────────────────────────┐
│ 无 active │ 创建新 incident（status='active'） │
│ incident │ 写入 event_log（event_type='triggered'） │
│ │ 写入 alert_record（alert_type='triggered'）│
├──────────────┼──────────────────────────────────────────┤
│ 有 active │ 更新 incident： │
│ incident │ last_triggered_at = effective_now │
│ │ trigger_count += 1 │
│ │ current_pv_value = 本次PV值 │
│ │ max_delta_value = MAX(历史,本次delta) │
│ │ 写入 event_log（event_type='ongoing'） │
└──────────────┴──────────────────────────────────────────┘
```

### 5.3 恢复逻辑

```
规则引擎未命中（恢复条件满足）
 ↓
查询当前 active incident（同归并键）
 ↓
┌──────────────┬──────────────────────────────────────────┐
│ 无 active │ 无操作 │
│ incident │ │
├──────────────┼──────────────────────────────────────────┤
│ 有 active │ 更新 incident： │
│ incident │ status = 'recovered' │
│ │ ended_at = effective_now │
│ │ 写入 event_log（event_type='recovered'） │
│ │ 写入 alert_record（alert_type='recovered'）│
└──────────────┴──────────────────────────────────────────┘

恢复后，下次再命中 → 创建全新 incident（允许再次触发）
```

### 5.4 前端展示要求

**预警中心新增两个 Tab**：

**Tab 1：事件视图（Incidents）**
- 列表字段：机房 / 阀门 / 规则名 / 状态（active/recovered）/ 首次触发时间 / 最近触发时间 / 持续次数 / 当前PV值
- 支持按状态、机房、时间范围筛选
- 点击进入事件详情

**Tab 2：告警记录（Records）**
- 原有告警列表（triggered/recovered 通知流水）
- 每条记录可跳转至所属 incident

**事件详情页**：
- 基本信息卡片（规则、阀门、时间跨度、触发次数）
- 时间轴：`triggered → ongoing × N → recovered`
- 关联PV曲线图（标注触发区间）

---

## 6. API 设计（v1.1 完整版）

### 6.1 数据导入

```
POST /api/import/upload
Content-Type: multipart/form-data
Body: file（xlsx/csv）

响应：
{
 "batch_id": "uuid",
 "status": "processing",
 "total_rows": 1000,
 "success_rows": 998,
 "failed_rows": 2,
 "error_detail": [
 {"row": 3, "field": "pv_value", "msg": "值超出范围(0~100)，实际值：105"},
 {"row": 7, "field": "timestamp", "msg": "时间格式错误，应为YYYY-MM-DD HH:MM:SS"}
 ]
}

GET /api/import/logs
GET /api/import/logs/{batch_id}
```

### 6.2 阀门管理

```
GET /api/valves -- 列表（支持分页/筛选）
GET /api/valves/{site_code}/{valve_id} -- 详情
PUT /api/valves/{site_code}/{valve_id} -- 更新（仅主数据字段）
GET /api/valves/{site_code}/{valve_id}/timeseries -- 时序曲线数据
```

### 6.3 规则管理

```
GET /api/rules -- 规则列表
POST /api/rules -- 创建规则
GET /api/rules/{id} -- 规则详情
PUT /api/rules/{id} -- 更新规则
DELETE /api/rules/{id} -- 删除规则（有关联 active incident 时拒绝）
PATCH /api/rules/{id}/toggle -- 启用/禁用
```

### 6.4 告警事件（v1.1 新增）

```
GET /api/alerts/incidents
参数：status, site_code, rule_id, page, page_size
响应：{ "total": n, "items": [ incident对象... ] }

GET /api/alerts/incidents/{id}
响应：incident详情 + event_logs列表

GET /api/alerts/active-summary
响应：{ "active_count": n, "sites_affected": [...], "latest_incident": {...} }

GET /api/alerts/records
参数：alert_type, site_code, is_read, page, page_size

PATCH /api/alerts/records/read-all -- 全部标为已读
PATCH /api/alerts/records/{id}/read -- 单条标为已读
```

### 6.5 系统设置

```
GET /api/system/time-mode
PUT /api/system/time-mode

GET /api/system/storage-usage
响应：{ "used_bytes": n, "limit_bytes": 1073741824, "used_percent": 72.3 }
```

### 6.6 监控看板

```
GET /api/dashboard/summary
响应：
{
 "total_valves": 120,
 "active_incidents": 3,
 "sites": [
 { "site_code": "IDC-A", "valve_count": 20, "active_incidents": 1 }
 ]
}

GET /api/dashboard/realtime
参数：site_code（可选）
响应：各阀门最新PV值 + 是否处于 active incident
```

---

## 7. 前端页面设计（v1.1）

### 7.1 全局 TopBar（v1.1 新增）

```
[Logo] [系统名称] [时间模式切换] [告警铃铛🔔] [用户]
```

**时间模式切换控件**：
- 实时模式：`● 实时模式`（绿色）
- 调试模式：`● 调试模式 2025-11-28 14:35:00`（黄色背景警示条）
- 点击 → 弹出设置对话框

**调试模式对话框**：
- 单选：实时 / 调试
- 调试时显示时间选择器（datetime-local，不允许选未来）
- 确认后全局生效，TopBar 持续显示当前模式

### 7.2 数据导入页

- 拖拽/点击上传区（支持 xlsx/csv）
- 上传后显示进度条
- 完成后展示：成功行数 / 失败行数 / 错误明细表格（可下载）
- 历史导入记录列表（批次ID / 文件名 / 时间 / 状态）
- 存储容量进度条（已用 / 上限 1GB）

### 7.3 监控看板

- 机房卡片列表（每卡片：机房名 / 阀门数 / 活跃告警数）
- 点击机房 → 阀门列表（表格：阀门ID / 类型 / 重要性 / 最新PV / 告警状态）
- 点击阀门 → 阀门详情（PV曲线图 + 告警标注）

### 7.4 预警中心

**Tab：事件视图（Incidents）**
- 筛选栏：状态 / 机房 / 规则 / 时间范围
- 列表：机房 / 阀门 / 规则名 / 状态标签 / 首次触发 / 最近触发 / 触发次数
- 点击 → 事件详情（时间轴 + PV曲线）

**Tab：告警记录（Records）**
- 筛选栏：类型（触发/恢复）/ 机房 / 已读/未读
- 列表：时间 / 机房 / 阀门 / 规则 / 类型 / PV值 / 已读状态
- 全部已读按钮

### 7.5 规则配置页

- 规则列表（名称 / 场景 / 机房范围 / 重要性筛选 / 启用状态）
- 新建/编辑规则表单：
 - 场景A：n_points / n_minutes / threshold / recover_points / recover_minutes
 - 场景B：window_minutes / delta_threshold / recover_delta_threshold
 - 通用：rule_name / site_code / valve_type_filter / importance_filter / enabled

### 7.6 系统设置页

- 时间模式设置（同 TopBar 入口，二选一）
- 存储容量状态
- 数据清理入口（按时间范围清理历史时序数据）

---

## 8. 数据导入事务策略

### 8.1 批次管理

- 每次上传创建一个 `import_logs` 记录，分配 `batch_id`
- 批次状态：`processing → completed / partial / failed`
- `partial`：有错误行但成功行 > 0
- `failed`：错误行占比超过 30%（可配置）时整批回滚

### 8.2 行级处理策略

```
逐行处理：
1. 字段完整性校验（必填字段不为空）
2. 格式校验（timestamp 格式、pv_value 数值范围）
3. 主数据同步：
 INSERT INTO valve_registry ... ON CONFLICT (site_code, valve_id)
 DO UPDATE SET valve_type=..., updated_at=NOW()
 （仅更新非核心字段，is_important 不被覆盖）
4. 时序数据写入：
 INSERT INTO timeseries_data ... ON CONFLICT (timestamp, site_code, valve_id)
 DO NOTHING（重复数据静默跳过，计入 skipped_rows）
```

### 8.3 字段校验规则

| 字段 | 必填 | 格式要求 | 错误处理 |
|------|------|---------|---------|
| `timestamp` | ✅ | `YYYY-MM-DD HH:MM:SS` | 行级跳过+记录错误 |
| `site_code` | ✅ | 非空字符串 | 行级跳过+记录错误 |
| `valve_id` | ✅ | 非空字符串 | 行级跳过+记录错误 |
| `valve_type` | ✅ | 非空字符串 | 行级跳过+记录错误 |
| `pv_value` | ✅ | 数值，0~100 | 行级跳过+记录错误 |
| `point_name` | ❌ | 字符串 | 置NULL继续 |
| `point_id` | ❌ | 字符串 | 置NULL继续 |

---

## 9. 性能策略

### 9.1 规则引擎增量执行

- 每次执行记录 `last_evaluated_at`（存 `system_settings`）
- 只查询 `timestamp > last_evaluated_at` 的新数据所涉及的阀门
- 对有新数据的阀门执行规则判定，无新数据的阀门跳过

### 9.2 规则缓存

- 启动时加载所有 `enabled=true` 的规则到内存
- 规则变更（增/删/改/启停）时主动刷新缓存
- 避免每次引擎执行都查询数据库

### 9.3 索引覆盖策略

- 场景A/B 核心查询走 `idx_ts_site_valve_time`（复合索引）
- active incident 查询走 `idx_incident_dim`（覆盖归并键+状态）
- 未读告警查询走 `idx_alert_unread`

### 9.4 执行频率

- 规则引擎：每 **1分钟** 执行一次（APScheduler interval）
- 存储容量检查：每 **10分钟** 执行一次
- 调试模式下引擎频率不变，但窗口基于 `debug_now`

---

## 10. 存储策略（MVP）

### 10.1 上限设定

- 业务数据总量上限：**1GB（1,073,741,824 bytes）**
- 监控范围：`timeseries_data` 表（主要数据体）

### 10.2 容量预警机制

| 使用率 | 行为 |
|--------|------|
| < 80% | 正常 |
| 80%~99% | 前端顶部黄色横幅警告 |
| ≥ 100% | 拒绝新导入，提示清理 |

### 10.3 数据清理 SOP

1. 进入"系统设置 → 数据清理"
2. 选择清理时间范围（如：清理 N 个月前的数据）
3. 系统预估可释放空间
4. 确认后执行 `DELETE FROM timeseries_data WHERE timestamp < :cutoff`
5. 执行 `VACUUM ANALYZE timeseries_data`（释放磁盘空间）
6. 记录清理日志

---

## 11. 功能验证清单对照（v1.1 补丁）

> 以下为 v1.0 验证清单中需要更新或新增的验证项。

### 新增验证项

| # | 验证项 | 预期结果 |
|---|--------|---------|
| V-NEW-01 | 场景A：仅满足N点不满足N分钟 | 不触发告警 |
| V-NEW-02 | 场景A：同时满足N点和N分钟 | 触发告警，创建新 incident |
| V-NEW-03 | 场景B：窗口内有断点（非连续采集） | 仍正常计算 max-min，允许跨断点 |
| V-NEW-04 | 同规则同阀门连续10次命中 | 1个 incident，10条 ongoing 日志 |
| V-NEW-05 | incident 恢复后再次命中 | 创建新 incident（不复用旧的） |
| V-NEW-06 | 不同规则对同一阀门命中 | 产生2个独立 incident |
| V-NEW-07 | 切换到调试模式并设置历史时间 | 规则引擎按 debug_now 计算窗口 |
| V-NEW-08 | 调试模式下导入历史数据并触发规则 | 告警正常产生，标记 debug 来源 |
| V-NEW-09 | 导入重复时序数据（相同时间戳） | 静默跳过，计入 skipped_rows |
| V-NEW-10 | 存储达到 80% | 前端显示黄色警告横幅 |
| V-NEW-11 | 存储达到 100% | 导入接口返回 403，提示清理 |
| V-NEW-12 | 修改阀门 is_important | 规则引擎下次执行时按新值判断 |

### 修订验证项

| 原验证项 | 修订内容 |
|---------|---------|
| 告警去重（原V-07） | 改为验证"归并逻辑"：同维度连续命中不重复创建 incident |
| 告警列表（原V-08） | 新增验证事件视图 Tab 和日志视图 Tab |

---

## 12. 数据字典（关键字段说明）

| 表 | 字段 | 说明 |
|---|------|------|
| `valve_registry` | `is_important` | 唯一真相源，规则筛选依据，不从时序表读取 |
| `timeseries_data` | `timestamp` | 采集时间，规则判定唯一时间轴 |
| `timeseries_data` | `data_source` | `excel_import` / `api_realtime` / `debug` |
| `alert_incidents` | `status` | `active`=持续中 / `recovered`=已恢复 / `closed`=人工关闭 |
| `alert_incidents` | `trigger_count` | 本次事件内累计命中次数 |
| `alert_event_logs` | `event_type` | `triggered`=首次 / `ongoing`=持续 / `recovered`=恢复 / `closed`=关闭 |
| `alert_event_logs` | `window_info` | JSONB，记录本次判定的窗口快照（点数、时间范围、delta等） |
| `system_settings` | `time_mode` | `realtime` / `debug` |
| `system_settings` | `debug_now` | 调试模式下的人工时间点，格式 `YYYY-MM-DD HH:MM:SS` |

---

*TDD v1.1 — 完整修订版 / 2026-03-13*
