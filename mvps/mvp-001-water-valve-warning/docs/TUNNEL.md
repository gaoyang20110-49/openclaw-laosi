# 内网穿透方案记录

> 用于 MVP 开发阶段的公网访问

---

## 方案概述

使用 **Tunnelmole** 实现内网穿透，将本地服务暴露到公网。

---

## 工具选择

| 工具 | 选择原因 |
|------|----------|
| **Tunnelmole** | 无需注册、无需 token、无验证码、简单易用 |
| Localtunnel | 需要 IP 验证 |
| Ngrok | 需要注册获取 token |
| Pagekite | 需要注册邮箱 |

---

## 安装步骤

```bash
# 安装 tunnelmole
npm install -g tunnelmole
```

---

## 使用方法

### 1. 启动本地服务

```bash
cd mvps/mvp-001-water-valve-warning
PORT=3001 node src/server.js
```

### 2. 启动内网穿透

```bash
# 前台运行（查看 URL）
tunnelmole 3001

# 后台运行
nohup tunnelmole 3001 > /tmp/tunnel.log 2>&1 &
```

### 3. 获取公网地址

启动后会输出类似：
```
https://qalltf-ip-101-126-130-124.tunnelmole.net → http://localhost:3001
```

---

## 当前项目地址

```
https://qalltf-ip-101-126-130-124.tunnelmole.net
```

---

## 优缺点

### 优点
- ✅ 无需注册账号
- ✅ 无需配置 token
- ✅ 无访问验证（不像 localtunnel 需要输入 IP）
- ✅ 支持 HTTPS
- ✅ 简单易用，一条命令搞定

### 缺点
- ❌ 免费版 URL 是随机的（每次重启会变）
- ❌ 有带宽限制
- ❌ 稳定性不如商业方案
- ❌ 不适合生产环境长期使用

---

## 使用场景

| 场景 | 建议 |
|------|------|
| **开发演示** | ✅ 推荐 |
| **临时测试** | ✅ 推荐 |
| **长期运行** | ❌ 不推荐 |
| **生产环境** | ❌ 严禁 |

---

## 安全建议

1. **仅用于开发/测试**，不要用于生产环境
2. **服务本身加认证**（如需要）
3. **用完即关**，不长期暴露
4. **不要暴露敏感数据**
5. **URL 不要随意分享**

---

## 备用方案

如果 Tunnelmole 不可用：

```bash
# 方案 1: SSH 反向隧道（需要 SSH 访问）
ssh -R 80:localhost:3001 localhost.run

# 方案 2: 配置云服务器安全组（推荐长期使用）
# 在云控制台开放 3001 端口
```

---

*记录时间: 2026-03-08*
