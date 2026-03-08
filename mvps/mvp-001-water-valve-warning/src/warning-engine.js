/**
 * MVP-001 预警引擎
 * 支持多种预警规则
 */

const fs = require('fs');
const path = require('path');

// 预警规则类型
const RULE_TYPES = {
    OPEN_LEVEL_CHANGE: 'open_level_change',    // 开度变化
    OPEN_LEVEL_HIGH: 'open_level_high',        // 开度过高
    OPEN_LEVEL_LOW: 'open_level_low',          // 开度过低
    ABNORMAL_FLUCTUATION: 'abnormal_fluctuation', // 异常波动
    NO_DATA: 'no_data'                          // 无数据
};

/**
 * 执行预警检查
 * @param {Array} valves 阀门数据
 * @param {Object} config 预警配置
 * @returns {Array} 预警列表
 */
function checkWarnings(valves, config) {
    const alerts = [];
    const rules = config.rules || [];
    
    // 按设备编号分组，按时间排序
    const grouped = groupByDevice(valves);
    
    Object.keys(grouped).forEach(deviceId => {
        const deviceData = grouped[deviceId];
        deviceData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        const latestData = deviceData[deviceData.length - 1];
        const previousData = deviceData[deviceData.length - 2];
        
        // 执行每条规则
        rules.forEach(rule => {
            if (!rule.enabled) return;
            
            let alert = null;
            
            switch (rule.type) {
                case RULE_TYPES.OPEN_LEVEL_CHANGE:
                    alert = checkOpenLevelChange(latestData, previousData, rule);
                    break;
                case RULE_TYPES.OPEN_LEVEL_HIGH:
                    alert = checkOpenLevelHigh(latestData, rule);
                    break;
                case RULE_TYPES.OPEN_LEVEL_LOW:
                    alert = checkOpenLevelLow(latestData, rule);
                    break;
                case RULE_TYPES.ABNORMAL_FLUCTUATION:
                    alert = checkAbnormalFluctuation(deviceData, rule);
                    break;
                case RULE_TYPES.NO_DATA:
                    alert = checkNoData(deviceData, rule);
                    break;
            }
            
            if (alert) {
                alerts.push(alert);
            }
        });
    });
    
    return alerts;
}

/**
 * 按设备编号分组
 */
function groupByDevice(valves) {
    const grouped = {};
    valves.forEach(v => {
        if (!grouped[v.deviceId]) {
            grouped[v.deviceId] = [];
        }
        grouped[v.deviceId].push(v);
    });
    return grouped;
}

/**
 * 检查开度变化
 */
function checkOpenLevelChange(current, previous, rule) {
    if (!current || !previous) return null;
    
    const diff = Math.abs(current.openLevel - previous.openLevel);
    
    if (diff >= rule.threshold) {
        return {
            id: generateAlertId(),
            deviceId: current.deviceId,
            deviceName: current.deviceName,
            location: current.location,
            ruleType: rule.type,
            ruleName: rule.name,
            currentValue: current.openLevel,
            previousValue: previous.openLevel,
            diff: diff.toFixed(1),
            threshold: rule.threshold,
            timestamp: current.timestamp,
            previousTimestamp: previous.timestamp,
            level: diff > rule.threshold * 5 ? 'critical' : 'warning',
            status: 'pending',
            message: `开度变化 ${diff.toFixed(1)}%，超过阈值 ${rule.threshold}%`
        };
    }
    
    return null;
}

/**
 * 检查开度过高
 */
function checkOpenLevelHigh(current, rule) {
    if (!current) return null;
    
    if (current.openLevel > rule.threshold) {
        return {
            id: generateAlertId(),
            deviceId: current.deviceId,
            deviceName: current.deviceName,
            location: current.location,
            ruleType: rule.type,
            ruleName: rule.name,
            currentValue: current.openLevel,
            threshold: rule.threshold,
            timestamp: current.timestamp,
            level: current.openLevel > rule.threshold * 1.5 ? 'critical' : 'warning',
            status: 'pending',
            message: `开度 ${current.openLevel}% 超过上限 ${rule.threshold}%`
        };
    }
    
    return null;
}

/**
 * 检查开度过低
 */
function checkOpenLevelLow(current, rule) {
    if (!current) return null;
    
    if (current.openLevel < rule.threshold) {
        return {
            id: generateAlertId(),
            deviceId: current.deviceId,
            deviceName: current.deviceName,
            location: current.location,
            ruleType: rule.type,
            ruleName: rule.name,
            currentValue: current.openLevel,
            threshold: rule.threshold,
            timestamp: current.timestamp,
            level: current.openLevel < rule.threshold * 0.5 ? 'critical' : 'warning',
            status: 'pending',
            message: `开度 ${current.openLevel}% 低于下限 ${rule.threshold}%`
        };
    }
    
    return null;
}

/**
 * 检查异常波动（多次变化）
 */
function checkAbnormalFluctuation(deviceData, rule) {
    if (deviceData.length < rule.sampleCount) return null;
    
    const recentData = deviceData.slice(-rule.sampleCount);
    let fluctuationCount = 0;
    
    for (let i = 1; i < recentData.length; i++) {
        const diff = Math.abs(recentData[i].openLevel - recentData[i-1].openLevel);
        if (diff >= rule.minChange) {
            fluctuationCount++;
        }
    }
    
    if (fluctuationCount >= rule.maxCount) {
        const latest = recentData[recentData.length - 1];
        return {
            id: generateAlertId(),
            deviceId: latest.deviceId,
            deviceName: latest.deviceName,
            location: latest.location,
            ruleType: rule.type,
            ruleName: rule.name,
            fluctuationCount,
            threshold: rule.maxCount,
            timestamp: latest.timestamp,
            level: 'warning',
            status: 'pending',
            message: `在最近 ${recentData.length} 次采样中发生 ${fluctuationCount} 次异常波动`
        };
    }
    
    return null;
}

/**
 * 检查无数据
 */
function checkNoData(deviceData, rule) {
    if (deviceData.length === 0) return null;
    
    const latest = deviceData[deviceData.length - 1];
    const now = new Date();
    const lastTime = new Date(latest.timestamp);
    const minutesDiff = (now - lastTime) / (1000 * 60);
    
    if (minutesDiff > rule.maxMinutes) {
        return {
            id: generateAlertId(),
            deviceId: latest.deviceId,
            deviceName: latest.deviceName,
            location: latest.location,
            ruleType: rule.type,
            ruleName: rule.name,
            lastTimestamp: latest.timestamp,
            noDataMinutes: Math.round(minutesDiff),
            threshold: rule.maxMinutes,
            timestamp: now.toISOString(),
            level: minutesDiff > rule.maxMinutes * 2 ? 'critical' : 'warning',
            status: 'pending',
            message: `数据中断 ${Math.round(minutesDiff)} 分钟，超过阈值 ${rule.maxMinutes} 分钟`
        };
    }
    
    return null;
}

/**
 * 生成预警 ID
 */
function generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取默认规则配置
 */
function getDefaultRules() {
    return [
        {
            id: 'rule_1',
            name: '开度变化检测',
            type: RULE_TYPES.OPEN_LEVEL_CHANGE,
            threshold: 0.1,  // 0.1%
            enabled: true,
            description: '检测开度前后变化是否超过阈值'
        },
        {
            id: 'rule_2',
            name: '开度过高检测',
            type: RULE_TYPES.OPEN_LEVEL_HIGH,
            threshold: 90,  // 90%
            enabled: false,
            description: '检测开度是否超过上限'
        },
        {
            id: 'rule_3',
            name: '开度过低检测',
            type: RULE_TYPES.OPEN_LEVEL_LOW,
            threshold: 10,  // 10%
            enabled: false,
            description: '检测开度是否低于下限'
        },
        {
            id: 'rule_4',
            name: '异常波动检测',
            type: RULE_TYPES.ABNORMAL_FLUCTUATION,
            sampleCount: 5,
            minChange: 0.5,
            maxCount: 3,
            enabled: false,
            description: '检测短时间内频繁波动'
        },
        {
            id: 'rule_5',
            name: '数据中断检测',
            type: RULE_TYPES.NO_DATA,
            maxMinutes: 5,
            enabled: false,
            description: '检测数据采集是否中断'
        }
    ];
}

module.exports = {
    checkWarnings,
    getDefaultRules,
    RULE_TYPES
};
