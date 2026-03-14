import React, { useState } from 'react'
import { useIncidents, useAlertRecords, useMarkRecordRead, useMarkAllRead, useActiveSummary } from '../hooks/useAlerts'

const AlertCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'incidents' | 'records'>('incidents')
  const { data: summaryData } = useActiveSummary()
  const { data: incidentsData } = useIncidents()
  const { data: recordsData } = useAlertRecords()
  const markReadMutation = useMarkRecordRead()
  const markAllReadMutation = useMarkAllRead()

  const incidents = incidentsData?.items || []
  const records = recordsData?.items || []
  const unreadCount = recordsData?.unread_count || 0

  return (
    <div className="space-y-8 animate-fadeInUp">
      {/* 页面标题 */}
      <div className="flex items-center justify-between animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
        <div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            预警中心
          </h2>
          <p className="text-gray-400 mt-2">实时监控和查看系统预警事件</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-lg shadow-orange-500/30">
            <span className="text-sm text-white/80">活跃事件</span>
            <span className="text-2xl font-bold text-white ml-2">{summaryData?.active_count || 0}</span>
          </div>
          <div className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl shadow-lg shadow-purple-500/30">
            <span className="text-sm text-white/80">未读通知</span>
            <span className="text-2xl font-bold text-white ml-2">{unreadCount}</span>
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="glass-card p-2 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
        <nav className="flex space-x-2">
          <button
            onClick={() => setActiveTab('incidents')}
            className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'incidents'
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="mr-2">📊</span>
            事件视图
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'records'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="mr-2">📋</span>
            告警记录
            {unreadCount > 0 && (
              <span className="ml-2 bg-white text-purple-600 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* 事件视图 Tab */}
      {activeTab === 'incidents' && (
        <div className="space-y-6 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
          {incidents.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-gray-700">暂无预警事件</h3>
              <p className="text-gray-500 mt-2">所有系统运行正常</p>
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.map((incident, index) => (
                <div
                  key={incident.id}
                  className={`glass-card p-6 relative overflow-hidden ${
                    incident.status === 'active'
                      ? 'border-red-300/50'
                      : 'border-green-300/50'
                  }`}
                  style={{ animationDelay: `${0.1 + index * 0.05}s` }}
                >
                  {/* 状态指示条 */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-2 ${
                      incident.status === 'active'
                        ? 'bg-gradient-to-b from-orange-500 to-red-500'
                        : 'bg-gradient-to-b from-green-500 to-emerald-500'
                    }`}
                  ></div>

                  {/* 背景装饰 */}
                  {incident.status === 'active' && (
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-orange-500/5 pointer-events-none"></div>
                  )}

                  <div className="pl-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className={`relative ${
                            incident.status === 'active'
                              ? 'bg-red-500'
                              : 'bg-green-500'
                          }`}>
                            <div className={`w-3 h-3 rounded-full ${
                              incident.status === 'active' ? 'bg-red-500' : 'bg-green-500'
                            }`}></div>
                            {incident.status === 'active' && (
                              <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-gray-800">
                            {incident.is_important && <span className="text-2xl mr-2">⭐</span>}
                            <span className="font-mono">{incident.site_code}</span>
                            <span className="text-gray-400 mx-2">·</span>
                            <span className="font-mono">{incident.valve_id}</span>
                          </h3>
                          <span className={`status-badge ${
                            incident.status === 'active' ? 'status-badge-warning' : 'status-badge-success'
                          }`}>
                            {incident.status === 'active' ? '⚠️ 活跃' : '✓ 已恢复'}
                          </span>
                        </div>

                        <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 space-y-2">
                          <div className="flex items-center space-x-2 text-gray-600">
                            <span className="text-lg">📜</span>
                            <span className="font-medium">规则: {incident.rule_name}</span>
                          </div>
                          <div className="flex items-center space-x-6 text-sm">
                            <span className="text-gray-500">
                              <span className="font-medium text-gray-700">首次触发:</span>{' '}
                              {new Date(incident.triggered_at).toLocaleString('zh-CN')}
                            </span>
                            <span className="text-gray-500">
                              <span className="font-medium text-gray-700">持续次数:</span>{' '}
                              <span className="font-bold text-purple-600">{incident.trigger_count}</span>
                            </span>
                            {incident.duration_minutes && (
                              <span className="text-gray-500">
                                <span className="font-medium text-gray-700">持续时长:</span>{' '}
                                <span className="font-bold text-orange-600">{incident.duration_minutes} 分钟</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button className="btn-gradient text-sm">
                        查看详情
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 告警记录 Tab */}
      {activeTab === 'records' && (
        <div className="space-y-6 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
          <div className="flex justify-end">
            <button
              onClick={() => markAllReadMutation.mutate()}
              className="btn-gradient"
            >
              ✓ 全部标为已读
            </button>
          </div>

          {records.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-bold text-gray-700">暂无告警记录</h3>
              <p className="text-gray-500 mt-2">系统还没有产生任何告警通知</p>
            </div>
          ) : (
            <div className="table-modern">
              <div className="px-8 py-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-800">告警记录列表</h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <span>共 {records.length} 条记录</span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-semibold">
                        {unreadCount} 条未读
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="px-6 py-4 text-left">状态</th>
                    <th className="px-6 py-4 text-left">类型</th>
                    <th className="px-6 py-4 text-left">机房/阀门</th>
                    <th className="px-6 py-4 text-left">消息</th>
                    <th className="px-6 py-4 text-left">时间</th>
                    <th className="px-6 py-4 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, index) => (
                    <tr
                      key={record.id}
                      className={`transition-all duration-200 ${
                        record.is_read ? '' : 'bg-purple-50/50 hover:bg-purple-50'
                      }`}
                    >
                      <td className="px-6 py-4">
                        {!record.is_read && (
                          <div className="relative">
                            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                            <div className="absolute inset-0 w-3 h-3 bg-purple-500 rounded-full animate-ping"></div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`status-badge ${
                          record.alert_type === 'triggered' ? 'status-badge-warning' : 'status-badge-success'
                        }`}>
                          {record.alert_type === 'triggered' ? '⚠️ 触发' : '✓ 恢复'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-semibold text-gray-900">{record.site_code}</span>
                          <span className="text-gray-400">·</span>
                          <span className="font-mono text-gray-700">{record.valve_id}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{record.message}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(record.alert_time).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-6 py-4">
                        {!record.is_read && (
                          <button
                            onClick={() => markReadMutation.mutate(record.id)}
                            className="btn-gradient text-sm"
                          >
                            标为已读
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AlertCenter
