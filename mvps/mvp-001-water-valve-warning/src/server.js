/**
 * MVP-001 水系统阀门异常预警 - 后端服务入口
 * 
 * 功能：
 * - 数据导入 API
 * - 预警逻辑引擎
 * - 前端数据 API
 * - 预警配置管理
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { checkWarnings, getDefaultRules } = require('./warning-engine');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// 数据存储路径
const DATA_DIR = path.join(__dirname, '../data');
const VALVES_FILE = path.join(DATA_DIR, 'valves.json');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');
const CONFIG_FILE = path.join(__dirname, '../config/warning-config.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(path.dirname(CONFIG_FILE))) {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
}

// 初始化数据文件
initializeDataFiles();

// 初始化数据文件
function initializeDataFiles() {
    if (!fs.existsSync(VALVES_FILE)) {
        fs.writeFileSync(VALVES_FILE, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(ALERTS_FILE)) {
        fs.writeFileSync(ALERTS_FILE, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(DEVICES_FILE)) {
        fs.writeFileSync(DEVICES_FILE, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(CONFIG_FILE)) {
        const defaultConfig = {
            rules: getDefaultRules(),
            checkInterval: 60000,
            enabled: true,
            alertRetentionDays: 30
        };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    }
}

// ==================== 阀门数据 API ====================

// 获取所有阀门数据
app.get('/api/valves', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(VALVES_FILE, 'utf-8'));
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 导入阀门数据（JSON 数组）
app.post('/api/valves/import', (req, res) => {
    try {
        const { valves } = req.body;
        if (!Array.isArray(valves)) {
            return res.status(400).json({ success: false, error: '数据格式错误，需要数组' });
        }
        
        // 验证数据格式
        const validValves = valves.filter(v => v.deviceId && v.openLevel !== undefined);
        
        // 追加数据
        const existing = JSON.parse(fs.readFileSync(VALVES_FILE, 'utf-8') || '[]');
        const updated = [...existing, ...validValves];
        fs.writeFileSync(VALVES_FILE, JSON.stringify(updated, null, 2));
        
        // 自动触发预警检查
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        if (config.enabled) {
            const newAlerts = checkWarnings(validValves, config);
            if (newAlerts.length > 0) {
                const allAlerts = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf-8') || '[]');
                const updatedAlerts = [...allAlerts, ...newAlerts];
                fs.writeFileSync(ALERTS_FILE, JSON.stringify(updatedAlerts, null, 2));
            }
        }
        
        res.json({ success: true, count: validValves.length, alertsGenerated: 0 });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 批量导入（替换模式）
app.post('/api/valves/import/replace', (req, res) => {
    try {
        const { valves } = req.body;
        if (!Array.isArray(valves)) {
            return res.status(400).json({ success: false, error: '数据格式错误' });
        }
        
        fs.writeFileSync(VALVES_FILE, JSON.stringify(valves, null, 2));
        
        // 触发预警检查
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        if (config.enabled) {
            const newAlerts = checkWarnings(valves, config);
            fs.writeFileSync(ALERTS_FILE, JSON.stringify(newAlerts, null, 2));
        }
        
        res.json({ success: true, count: valves.length });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 获取阀门详情
app.get('/api/valves/:id', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(VALVES_FILE, 'utf-8'));
        const valve = data.find(v => v.id === req.params.id || v.deviceId === req.params.id);
        
        if (!valve) {
            return res.status(404).json({ success: false, error: '未找到' });
        }
        
        // 获取该设备的历史数据
        const history = data.filter(v => v.deviceId === valve.deviceId)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        res.json({ success: true, data: { ...valve, history } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 删除阀门数据
app.delete('/api/valves', (req, res) => {
    try {
        fs.writeFileSync(VALVES_FILE, JSON.stringify([], null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==================== 预警 API ====================

// 获取所有预警
app.get('/api/alerts', (req, res) => {
    try {
        const { status, level, limit } = req.query;
        let data = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf-8'));
        
        // 过滤
        if (status) {
            data = data.filter(a => a.status === status);
        }
        if (level) {
            data = data.filter(a => a.level === level);
        }
        
        // 排序（最新在前）
        data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // 限制数量
        if (limit) {
            data = data.slice(0, parseInt(limit));
        }
        
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 获取预警详情
app.get('/api/alerts/:id', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf-8'));
        const alert = data.find(a => a.id === req.params.id);
        
        if (!alert) {
            return res.status(404).json({ success: false, error: '未找到' });
        }
        
        // 获取该设备的历史数据用于趋势展示
        const valves = JSON.parse(fs.readFileSync(VALVES_FILE, 'utf-8'));
        const history = valves.filter(v => v.deviceId === alert.deviceId)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        res.json({ success: true, data: { ...alert, history } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 手动触发预警检查
app.post('/api/alerts/check', (req, res) => {
    try {
        const valves = JSON.parse(fs.readFileSync(VALVES_FILE, 'utf-8'));
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        
        const newAlerts = checkWarnings(valves, config);
        
        // 保存新预警
        const existing = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf-8') || '[]');
        const updated = [...existing, ...newAlerts];
        fs.writeFileSync(ALERTS_FILE, JSON.stringify(updated, null, 2));
        
        res.json({ success: true, alertCount: newAlerts.length, alerts: newAlerts });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 更新预警状态
app.patch('/api/alerts/:id', (req, res) => {
    try {
        const { status } = req.body;
        const data = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf-8'));
        const index = data.findIndex(a => a.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ success: false, error: '未找到' });
        }
        
        data[index].status = status;
        data[index].updatedAt = new Date().toISOString();
        fs.writeFileSync(ALERTS_FILE, JSON.stringify(data, null, 2));
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 批量更新预警状态
app.post('/api/alerts/batch-update', (req, res) => {
    try {
        const { ids, status } = req.body;
        const data = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf-8'));
        
        let updatedCount = 0;
        data.forEach(alert => {
            if (ids.includes(alert.id)) {
                alert.status = status;
                alert.updatedAt = new Date().toISOString();
                updatedCount++;
            }
        });
        
        fs.writeFileSync(ALERTS_FILE, JSON.stringify(data, null, 2));
        
        res.json({ success: true, updatedCount });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 清空预警
app.delete('/api/alerts', (req, res) => {
    try {
        fs.writeFileSync(ALERTS_FILE, JSON.stringify([], null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==================== 预警配置 API ====================

// 获取预警配置
app.get('/api/config', (req, res) => {
    try {
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        res.json({ success: true, data: config });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 更新预警配置
app.post('/api/config', (req, res) => {
    try {
        const config = req.body;
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 更新单条规则
app.post('/api/config/rules', (req, res) => {
    try {
        const { rule } = req.body;
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        
        const index = config.rules.findIndex(r => r.id === rule.id);
        if (index >= 0) {
            config.rules[index] = rule;
        } else {
            config.rules.push(rule);
        }
        
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 获取默认规则
app.get('/api/config/rules/default', (req, res) => {
    res.json({ success: true, data: getDefaultRules() });
});

// ==================== 统计 API ====================

// 仪表盘统计数据
app.get('/api/dashboard/stats', (req, res) => {
    try {
        const valves = JSON.parse(fs.readFileSync(VALVES_FILE, 'utf-8'));
        const alerts = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf-8'));
        
        // 设备统计
        const deviceIds = [...new Set(valves.map(v => v.deviceId))];
        
        // 位置统计
        const locationStats = {};
        valves.forEach(v => {
            const room = v.location?.room || '未知机房';
            if (!locationStats[room]) {
                locationStats[room] = { room, totalValves: 0, totalAlerts: 0, devices: new Set() };
            }
            locationStats[room].totalValves++;
            locationStats[room].devices.add(v.deviceId);
        });
        
        alerts.forEach(a => {
            const room = a.location?.room || '未知机房';
            if (locationStats[room]) {
                locationStats[room].totalAlerts++;
            }
        });
        
        // 预警级别统计
        const levelStats = {
            warning: alerts.filter(a => a.level === 'warning').length,
            critical: alerts.filter(a => a.level === 'critical').length
        };
        
        // 预警状态统计
        const statusStats = {
            pending: alerts.filter(a => a.status === 'pending').length,
            processing: alerts.filter(a => a.status === 'processing').length,
            resolved: alerts.filter(a => a.status === 'resolved').length
        };
        
        res.json({
            success: true,
            data: {
                totalValves: valves.length,
                totalDevices: deviceIds.length,
                totalAlerts: alerts.length,
                criticalAlerts: levelStats.critical,
                pendingAlerts: statusStats.pending,
                locationStats: Object.values(locationStats).map(l => ({
                    ...l,
                    deviceCount: l.devices.size
                })),
                levelStats,
                statusStats
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 获取设备列表
app.get('/api/devices', (req, res) => {
    try {
        const valves = JSON.parse(fs.readFileSync(VALVES_FILE, 'utf-8'));
        
        // 按设备分组，获取最新数据
        const devicesMap = {};
        valves.forEach(v => {
            if (!devicesMap[v.deviceId]) {
                devicesMap[v.deviceId] = {
                    deviceId: v.deviceId,
                    deviceName: v.deviceName,
                    location: v.location,
                    deviceType: v.location?.deviceType || '未知',
                    latestOpenLevel: v.openLevel,
                    latestTimestamp: v.timestamp,
                    dataPoints: 0
                };
            }
            devicesMap[v.deviceId].dataPoints++;
            
            // 更新最新数据
            if (new Date(v.timestamp) > new Date(devicesMap[v.deviceId].latestTimestamp)) {
                devicesMap[v.deviceId].latestOpenLevel = v.openLevel;
                devicesMap[v.deviceId].latestTimestamp = v.timestamp;
            }
        });
        
        const devices = Object.values(devicesMap);
        res.json({ success: true, data: devices });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 获取设备历史数据（用于趋势图）
app.get('/api/devices/:deviceId/history', (req, res) => {
    try {
        const { deviceId } = req.params;
        const { limit, hours } = req.query;
        
        let data = JSON.parse(fs.readFileSync(VALVES_FILE, 'utf-8'));
        data = data.filter(v => v.deviceId === deviceId);
        
        // 时间过滤
        if (hours) {
            const cutoff = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
            data = data.filter(v => new Date(v.timestamp) >= cutoff);
        }
        
        // 排序
        data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // 限制数量
        if (limit) {
            data = data.slice(-parseInt(limit));
        }
        
        // 转换为图表数据格式
        const chartData = data.map(v => ({
            timestamp: v.timestamp,
            value: v.openLevel,
            deviceName: v.deviceName
        }));
        
        res.json({ success: true, data: chartData });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==================== 健康检查 ====================

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 启动服务
app.listen(PORT, () => {
    console.log(`MVP-001 服务已启动: http://localhost:${PORT}`);
});
