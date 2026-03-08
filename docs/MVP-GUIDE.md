# MVP 项目通用指南

> 所有 MVP 项目的共享规范和工具说明

---

## 1. 内网穿透方案（标准）

所有 MVP 项目的演示和验证，统一使用 **Tunnelmole** 进行内网穿透。

### 安装

```bash
npm install -g tunnelmole
```

### 使用方法

```bash
# 1. 先启动本地服务
PORT=3001 node src/server.js

# 2. 再启动内网穿透
tunnelmole 3001

# 或后台运行
nohup tunnelmole 3001 > /tmp/tunnel.log 2>&1 &
```

### 获取公网地址

启动后会输出类似：
```
https://xxxxx-ip-xx-xx-xx-xx.tunnelmole.net → http://localhost:3001
```

### 注意事项

- URL 每次重启会变，需要重新记录
- 免费版有带宽限制
- 仅用于开发和演示，不用于生产环境
- 用完及时关闭

---

## 2. MVP 项目规范

### 命名规范

```
mvp-XXX-功能简称
```

示例：
- `mvp-001-water-valve-warning`
- `mvp-002-data-monitor`

### 目录结构

```
mvp-XXX-name/
├── README.md              # 项目说明
├── src/                   # 源代码
├── config/                # 配置文件
├── data/                  # 数据存储
├── docs/                  # 文档
│   ├── REQUIREMENTS.md   # 需求文档
│   └── TUNNEL.md         # 内网穿透记录（可选）
└── frontend/             # 前端代码（如有）
```

### 端口分配

| MVP 项目 | 端口 |
|----------|------|
| mvp-001 | 3001 |
| mvp-002 | 3002 |
| mvp-003 | 3003 |
| ... | ... |

---

## 3. 技术栈推荐

| 模块 | 推荐技术 | 说明 |
|------|----------|------|
| 后端 | Node.js + Express | 快速开发 |
| 前端 | Vue.js 3 | 响应式框架 |
| 图表 | ECharts | 数据可视化 |
| 数据存储 | JSON 文件 | 简单 MVP 阶段 |
| 内网穿透 | Tunnelmole | 无需注册 |

---

## 4. 快速启动模板

```bash
# 进入 MVP 目录
cd mvps/mvp-XXX-name

# 安装依赖
npm install

# 启动服务
PORT=3001 node src/server.js

# 启动内网穿透（新终端）
tunnelmole 3001
```

---

## 5. 项目清单

| 序号 | 项目 | 状态 | 端口 | 内网穿透地址 |
|------|------|------|------|--------------|
| 001 | 水系统阀门异常预警 | ✅ 已完成 | 3001 | https://qalltf-ip-101-126-130-124.tunnelmole.net |
| 002 | (待添加) | - | 3002 | - |

---

*最后更新: 2026-03-08*
