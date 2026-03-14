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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">预警中心</h2>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">
            活跃事件: <span className="text-red-500 font-bold">{summaryData?.active_count || 0}</span>
          </span>
          <span className="text-sm text-gray-500">
            未读通知: <span className="text-red-500 font-bold">{unreadCount}</span>
          </span>
        </div>
      </div>
      
      {/* Tab 切换 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('incidents')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'incidents'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            事件视图
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'records'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            告警记录
            {unreadCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        </nav>
      </div>
      
      {/* 事件视图 Tab */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          {incidents.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              暂无预警事件
            </div>
          ) : (
            incidents.map(incident => (
              <div
                key={incident.id}
                className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                  incident.status === 'active' ? 'border-red-500' : 'border-green-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${
                        incident.status === 'active' ? 'bg-red-500' : 'bg-green-500'
                      }`} />
                      <h3 className="text-lg font-semibold text-gray-800">
                        {incident.is_important && <span className="text-yellow-500 mr-1">⭐</span>}
                        {incident.site_code} · {incident.valve_id}
                      </h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        incident.status === 'active'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {incident.status === 'active' ? '活跃' : '已恢复'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">规则: {incident.rule_name}</p>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                      <span>首次触发: {new Date(incident.triggered_at).toLocaleString()}</span>
                      <span>持续次数: {incident.trigger_count}</span>
                      {incident.duration_minutes && (
                        <span>持续时长: {incident.duration_minutes} 分钟</span>
                      )}
                    </div>
                  </div>
                  <button className="text-blue-600 hover:text-blue-800 text-sm">
                    查看详情
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      
      {/* 告警记录 Tab */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => markAllReadMutation.mutate()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              全部标为已读
            </button>
          </div>
          
          {records.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              暂无告警记录
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">机房/阀门</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">消息</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {records.map(record => (
                    <tr key={record.id} className={record.is_read ? '' : 'bg-blue-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {!record.is_read && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full inline-block" />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          record.alert_type === 'triggered'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {record.alert_type === 'triggered' ? '触发' : '恢复'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.site_code} · {record.valve_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {record.message}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(record.alert_time).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {!record.is_read && (
                          <button
                            onClick={() => markReadMutation.mutate(record.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
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
