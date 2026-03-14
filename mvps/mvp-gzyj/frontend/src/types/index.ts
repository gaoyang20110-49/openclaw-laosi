// 全局类型定义

// 阀门数据
export interface Valve {
  id: number
  site_code: string
  valve_id: string
  valve_type: string
  point_name?: string
  point_id?: string
  is_important: boolean
  updated_at: string
}

// 时序数据点
export interface TimeseriesPoint {
  timestamp: string
  pv_value: number
}

// 最新阀门数据
export interface LatestValveData {
  valve_id: string
  valve_name?: string
  valve_type: string
  is_important: boolean
  pv_value?: number
  timestamp?: string
}

// 预警事件
export interface Incident {
  id: number
  rule_id: number
  rule_name: string
  site_code: string
  valve_id: string
  valve_name?: string
  is_important: boolean
  status: 'active' | 'recovered' | 'closed'
  triggered_at: string
  resolved_at?: string
  last_triggered: string
  trigger_count: number
  duration_minutes?: number
}

// 事件日志
export interface EventLog {
  id: number
  event_type: 'triggered' | 'ongoing' | 'recovered' | 'closed'
  event_time: string
  pv_value?: number
  delta_value?: number
}

// 告警记录
export interface AlertRecord {
  id: number
  incident_id?: number
  rule_name: string
  site_code: string
  valve_id: string
  alert_type: 'triggered' | 'recovered'
  alert_time: string
  pv_value?: number
  message: string
  is_read: boolean
}

// 预警规则
export interface AlertRule {
  id: number
  rule_name: string
  scene_type: 'A' | 'B'
  site_code?: string
  valve_type_filter?: string
  importance_filter: 'all' | 'important' | 'normal'
  enabled: boolean
  params: {
    // 场景A
    n_points?: number
    n_minutes?: number
    threshold?: number
    recover_points?: number
    recover_minutes?: number
    // 场景B
    window_minutes?: number
    delta_threshold?: number
    recover_delta_threshold?: number
  }
  created_at: string
  updated_at: string
}

// 导入日志
export interface ImportLog {
  id: number
  batch_id: string
  file_name: string
  total_rows: number
  success_rows: number
  failed_rows: number
  skipped_rows: number
  status: 'processing' | 'completed' | 'failed' | 'partial'
  created_at: string
}

// 机房汇总
export interface SiteSummary {
  site_code: string
  valve_count: number
  active_incidents: number
}

// 看板汇总
export interface DashboardSummary {
  total_valves: number
  active_incidents: number
  sites: SiteSummary[]
}

// 实时监控数据
export interface RealtimeValveData extends LatestValveData {
  has_active_incident: boolean
}
