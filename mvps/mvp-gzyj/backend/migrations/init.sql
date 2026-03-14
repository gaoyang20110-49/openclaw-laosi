# IDC机房旁通阀异动故障预警工具 - 数据库初始化脚本
# 版本: TDD v1.1

-- ============================================================
-- 1. 阀门主数据（SSOT）
-- ============================================================
CREATE TABLE IF NOT EXISTS valve_registry (
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
CREATE INDEX IF NOT EXISTS idx_valve_site ON valve_registry(site_code);
CREATE INDEX IF NOT EXISTS idx_valve_important ON valve_registry(is_important);

-- ============================================================
-- 2. 时序数据（事实表）
-- ============================================================
CREATE TABLE IF NOT EXISTS timeseries_data (
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
CREATE INDEX IF NOT EXISTS idx_ts_site_valve_time
    ON timeseries_data(site_code, valve_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ts_time
    ON timeseries_data(timestamp DESC);

-- ============================================================
-- 3. 规则配置
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    scene_type VARCHAR(10) NOT NULL
        CHECK (scene_type IN ('A', 'B')),
    site_code VARCHAR(50),
    valve_type_filter VARCHAR(100),
    importance_filter VARCHAR(20) NOT NULL DEFAULT 'all'
        CHECK (importance_filter IN ('all','important','normal')),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    params JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. 持续告警事件
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_incidents (
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
CREATE INDEX IF NOT EXISTS idx_incident_active
    ON alert_incidents(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_dim
    ON alert_incidents(rule_id, site_code, valve_id, status);

-- ============================================================
-- 5. 事件过程日志
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_event_logs (
    id BIGSERIAL PRIMARY KEY,
    incident_id BIGINT NOT NULL REFERENCES alert_incidents(id),
    event_type VARCHAR(20) NOT NULL
        CHECK (event_type IN ('triggered','ongoing','recovered','closed')),
    event_time TIMESTAMP NOT NULL,
    pv_value NUMERIC(6,2),
    delta_value NUMERIC(6,2),
    window_info JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_log_incident
    ON alert_event_logs(incident_id, event_time DESC);

-- ============================================================
-- 6. 告警记录（通知/列表展示）
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_records (
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
CREATE INDEX IF NOT EXISTS idx_alert_unread
    ON alert_records(is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_site_valve
    ON alert_records(site_code, valve_id, created_at DESC);

-- ============================================================
-- 7. 导入日志
-- ============================================================
CREATE TABLE IF NOT EXISTS import_logs (
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
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- ============================================================
-- 8. 系统设置
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 初始化时间模式设置
INSERT INTO system_settings(key, value) VALUES
    ('time_mode', 'realtime'),
    ('debug_now', ''),
    ('storage_limit_bytes', '1073741824')
ON CONFLICT (key) DO NOTHING;
