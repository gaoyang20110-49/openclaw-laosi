# HANDOFF.md — IDC机房旁通阀异动故障预警工具
> 每次会话结束必须更新本文件。下次会话恢复上下文的唯一来源。
> 最后更新：2026-03-13

---

## 1. 当前断点

**阶段**：MVP开发完成 —— 全部TASK已完成 ✅

**已完成**：
- [x] 四份核心文档：AGENT.md / PLAN.md / TDD.md / PRD.md
- [x] TASK-01: 项目初始化 ✅
- [x] TASK-02: 数据库 + 数据导入服务 ✅
- [x] TASK-03: 阀门管理 API + 监控看板 API ✅
- [x] TASK-04: 规则配置 API ✅
- [x] TASK-05: 规则引擎核心（场景A/B）✅
- [x] TASK-06: 预警服务 + 事件归并 ✅
- [x] TASK-07: 时间模式 API + 调度器 ✅
- [x] TASK-08: 前端脚手架完善 + 路由框架 ✅
- [x] TASK-09: 前端 - 数据导入页面 ✅
  - 文件上传（拖拽/点击）
  - 导入结果展示
  - 阀门档案列表 + 重要性标记
  - 批量标记功能
- [x] TASK-10: 前端 - 监控看板页面 ✅
  - 机房切换
  - 阀门卡片网格
  - 数据明细表格
- [x] TASK-11: 前端 - 预警中心页面 ✅
  - 双Tab结构（事件视图/告警记录）
  - 事件列表
  - 告警记录列表
  - 已读/未读标记
- [x] TASK-12: 前端 - 规则配置页面 ✅
  - 规则列表
  - 新建/编辑规则表单
  - 场景A/B参数配置
  - 启用/停用/删除
- [x] TASK-13: 前端 - 历史查询页面 ✅
  - 查询条件
  - PV曲线图（Recharts）
  - 数据明细表

**当前进度**：MVP功能100%完成

**下一步**：部署测试或功能迭代

---

## 2. 项目结构

```
mvp-gzyj/
├── 核心文档/
│   ├── AGENT.md       # 工作协议
│   ├── PLAN.md        # 开发规格
│   ├── TDD.md         # 技术设计
│   ├── PRD.md         # 产品需求
│   └── HANDOFF.md     # 本文件
├── backend/           # ✅ FastAPI后端
│   ├── app/
│   │   ├── main.py              # FastAPI入口
│   │   ├── config.py            # 配置
│   │   ├── database.py          # 数据库+DDL初始化
│   │   ├── scheduler.py         # APScheduler
│   │   ├── models/              # 8个ORM模型
│   │   ├── routers/             # 7个API路由 ✅
│   │   │   ├── import_data.py
│   │   │   ├── valves.py
│   │   │   ├── timeseries.py
│   │   │   ├── dashboard.py
│   │   │   ├── rules.py
│   │   │   ├── alerts.py
│   │   │   └── settings.py
│   │   └── services/            # 业务逻辑
│   │       ├── import_service.py
│   │       ├── rule_engine.py   # 核心引擎
│   │       └── time_service.py
│   └── migrations/
│       └── init.sql             # 完整DDL
├── frontend/          # ✅ React前端
│   ├── package.json
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx              # 路由+布局
│   │   ├── index.css
│   │   ├── api/
│   │   │   └── client.ts        # axios实例
│   │   ├── hooks/               # React Query hooks
│   │   │   ├── useValves.ts
│   │   │   ├── useRules.ts
│   │   │   ├── useAlerts.ts
│   │   │   └── useImport.ts
│   │   ├── store/
│   │   │   └── settingsStore.ts # Zustand状态
│   │   ├── types/
│   │   │   └── index.ts         # TypeScript类型
│   │   └── pages/               # 5个页面 ✅
│   │       ├── Dashboard.tsx
│   │       ├── Import.tsx
│   │       ├── AlertCenter.tsx
│   │       ├── RuleConfig.tsx
│   │       └── History.tsx
│   └── ...
├── nginx/
│   └── nginx.conf     # 反向代理配置
├── docker-compose.yml # Docker编排
└── .env.example       # 环境变量模板
```

---

## 3. 功能清单

### 后端API（19个端点）
- ✅ 数据导入: upload, logs
- ✅ 阀门管理: list, sites, importance
- ✅ 时序数据: latest, history
- ✅ 监控看板: summary, realtime
- ✅ 规则配置: CRUD + toggle
- ✅ 预警中心: incidents, records, active-summary
- ✅ 系统设置: time-mode, storage-usage

### 前端页面（5个）
- ✅ 监控看板: 机房切换、阀门卡片、数据表格
- ✅ 数据导入: 文件上传、导入历史、阀门档案
- ✅ 预警中心: 双Tab、事件列表、告警记录
- ✅ 规则配置: 规则列表、新建/编辑表单
- ✅ 历史查询: 曲线图、数据明细

### 核心引擎
- ✅ 场景A: OR逻辑（点数OR时长）
- ✅ 场景B: 跨断点计算max-min
- ✅ 事件归并: triggered→ongoing→recovered
- ✅ 双模式时间: realtime/debug
- ✅ 定时调度: 每分钟执行

---

## 4. 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Tailwind CSS |
| 状态管理 | Zustand + TanStack Query |
| 图表 | Recharts |
| 后端 | Python 3.11 + FastAPI |
| 数据库 | PostgreSQL 15 |
| 调度 | APScheduler |
| 部署 | Docker Compose + Nginx |

---

## 5. 启动命令

```bash
# 启动所有服务
docker-compose up --build

# 后端地址: http://localhost:8000
# 前端地址: http://localhost:5173
# Nginx地址: http://localhost:80
```

---

## 6. 关键决策

| # | 决策 | 结论 |
|---|------|------|
| 1 | 场景A判定 | OR逻辑（PRD v1.5）|
| 2 | 场景B判定 | 允许跨断点 |
| 3 | 事件归并 | rule_id+site+valve |
| 4 | 规则删除 | active incident禁止删除 |
| 5 | 重要性SSOT | valve_registry表 |
| 6 | 存储上限 | 1GB，80%预警 |

---

*MVP开发完成，准备部署测试*
