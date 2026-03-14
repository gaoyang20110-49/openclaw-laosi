import React, { useState } from 'react'
import { useSites, useDashboardRealtime, useDashboardSummary } from '../hooks/useValves'

const Dashboard: React.FC = () => {
  const [selectedSite, setSelectedSite] = useState<string>('')

  const { data: sitesData } = useSites()
  const { data: summaryData } = useDashboardSummary()
  const { data: realtimeData } = useDashboardRealtime(selectedSite || undefined)

  const sites = sitesData?.sites || []
  const summary = summaryData
  const valves = realtimeData?.valves || []

  // 自动选择第一个机房
  React.useEffect(() => {
    if (sites.length > 0 && !selectedSite) {
      setSelectedSite(sites[0])
    }
  }, [sites, selectedSite])

  // 计算统计数据
  const stats = React.useMemo(() => {
    const total = valves.length
    const important = valves.filter(v => v.is_important).length
    const incident = valves.filter(v => v.has_active_incident).length
    const normal = total - incident

    return { total, important, incident, normal }
  }, [valves])

  return (
    <div className="space-y-8 animate-fadeInUp">
      {/* 页面标题 */}
      <div className="flex items-center justify-between animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
        <div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            监控看板
          </h2>
          <p className="text-gray-400 mt-2">实时监控机房旁通阀运行状态</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-lg shadow-orange-500/30">
            <span className="text-sm text-white/80">活跃预警</span>
            <span className="text-2xl font-bold text-white ml-2">{summary?.active_incidents || 0}</span>
          </div>
          <div className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl shadow-lg shadow-blue-500/30">
            <span className="text-sm text-white/80">总阀门</span>
            <span className="text-2xl font-bold text-white ml-2">{summary?.total_valves || 0}</span>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
        <div className="data-card data-card-primary">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-white/80 font-medium">总阀门数</p>
              <p className="text-4xl font-bold mt-2">{stats.total}</p>
              <p className="text-xs text-white/60 mt-2">全部监控阀门</p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl animate-float">
              📊
            </div>
          </div>
          <div className="mt-4">
            <div className="progress-bar">
              <div className="progress-bar-fill bg-white" style={{ width: '100%' }}></div>
            </div>
          </div>
        </div>

        <div className="data-card data-card-warning">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-white/80 font-medium">活跃预警</p>
              <p className="text-4xl font-bold mt-2">{stats.incident}</p>
              <p className="text-xs text-white/60 mt-2">需要关注处理</p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl animate-float" style={{ animationDelay: '0.5s' }}>
              🚨
            </div>
          </div>
          <div className="mt-4">
            <div className="progress-bar">
              <div className="progress-bar-fill bg-white" style={{ width: `${stats.total > 0 ? (stats.incident / stats.total) * 100 : 0}%` }}></div>
            </div>
          </div>
        </div>

        <div className="data-card data-card-success">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-white/80 font-medium">正常运行</p>
              <p className="text-4xl font-bold mt-2">{stats.normal}</p>
              <p className="text-xs text-white/60 mt-2">状态良好</p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl animate-float" style={{ animationDelay: '1s' }}>
              ✅
            </div>
          </div>
          <div className="mt-4">
            <div className="progress-bar">
              <div className="progress-bar-fill bg-white" style={{ width: `${stats.total > 0 ? (stats.normal / stats.total) * 100 : 0}%` }}></div>
            </div>
          </div>
        </div>

        <div className="data-card data-card-info">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-white/80 font-medium">重要阀门</p>
              <p className="text-4xl font-bold mt-2">{stats.important}</p>
              <p className="text-xs text-white/60 mt-2">重点监控对象</p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl animate-float" style={{ animationDelay: '1.5s' }}>
              ⭐
            </div>
          </div>
          <div className="mt-4">
            <div className="progress-bar">
              <div className="progress-bar-fill bg-white" style={{ width: `${stats.total > 0 ? (stats.important / stats.total) * 100 : 0}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* 机房选择 */}
      <div className="glass-card p-6 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-lg font-semibold text-gray-800 mb-2">
              选择机房
            </label>
            <p className="text-sm text-gray-500">选择要监控的机房区域</p>
          </div>
          <select
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="input-modern min-w-[300px]"
          >
            {sites.map(site => (
              <option key={site} value={site}>{site}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 阀门卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
        {valves.map((valve, index) => (
          <div
            key={valve.valve_id}
            className={`glass-card p-6 relative overflow-hidden ${
              valve.has_active_incident
                ? 'border-red-300/50'
                : valve.is_important
                ? 'border-yellow-300/50'
                : 'border-green-300/50'
            }`}
            style={{ animationDelay: `${0.1 + index * 0.05}s` }}
          >
            {/* 状态指示条 */}
            <div
              className={`absolute left-0 top-0 bottom-0 w-2 ${
                valve.has_active_incident
                  ? 'bg-gradient-to-b from-orange-500 to-red-500'
                  : valve.is_important
                  ? 'bg-gradient-to-b from-yellow-500 to-orange-500'
                  : 'bg-gradient-to-b from-green-500 to-emerald-500'
              }`}
            ></div>

            {/* 内容 */}
            <div className="pl-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-3xl">
                    {valve.is_important ? '⭐' : '🔧'}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">
                      {valve.valve_id}
                    </h3>
                    <p className="text-sm text-gray-500">{valve.valve_type}</p>
                  </div>
                </div>
                <span className={`status-badge ${
                  valve.has_active_incident ? 'status-badge-warning' : 'status-badge-success'
                }`}>
                  {valve.has_active_incident ? '⚠️ 预警' : '✓ 正常'}
                </span>
              </div>

              {/* PV值展示 */}
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 shadow-inner">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    {valve.pv_value?.toFixed(1) || '-'}
                  </span>
                  <span className="text-xl font-semibold text-gray-600">%</span>
                </div>
                <div className="progress-bar h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`progress-bar-fill h-3 rounded-full ${
                      valve.has_active_incident
                        ? 'bg-gradient-to-r from-orange-500 to-red-500'
                        : valve.is_important
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500'
                    }`}
                    style={{ width: `${valve.pv_value || 0}%` }}
                  ></div>
                </div>
              </div>

              {/* 时间戳 */}
              <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                <span>更新时间</span>
                <span>
                  {valve.timestamp ? new Date(valve.timestamp).toLocaleTimeString('zh-CN') : '无数据'}
                </span>
              </div>
            </div>

            {/* 背景装饰 */}
            {valve.has_active_incident && (
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-orange-500/5 pointer-events-none"></div>
            )}
          </div>
        ))}
      </div>

      {/* 阀门明细表 */}
      <div className="table-modern animate-fadeInUp" style={{ animationDelay: '0.5s' }}>
        <div className="px-8 py-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-800">阀门数据明细</h3>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <span>共 {valves.length} 条记录</span>
            </div>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-6 py-4 text-left">阀门编号</th>
              <th className="px-6 py-4 text-left">重要性</th>
              <th className="px-6 py-4 text-left">类型</th>
              <th className="px-6 py-4 text-left">PV值</th>
              <th className="px-6 py-4 text-left">状态</th>
            </tr>
          </thead>
          <tbody>
            {valves.map(valve => (
              <tr key={valve.valve_id} className="hover:bg-purple-50/30 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-semibold text-gray-900">{valve.valve_id}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    valve.is_important
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-lg shadow-yellow-500/30'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {valve.is_important ? '⭐ 重要' : '普通'}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-700">{valve.valve_type}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          valve.has_active_incident
                            ? 'bg-gradient-to-r from-orange-500 to-red-500'
                            : 'bg-gradient-to-r from-green-500 to-emerald-500'
                        }`}
                        style={{ width: `${valve.pv_value || 0}%` }}
                      ></div>
                    </div>
                    <span className="font-semibold text-gray-900">
                      {valve.pv_value?.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`status-badge ${
                    valve.has_active_incident ? 'status-badge-warning' : 'status-badge-success'
                  }`}>
                    {valve.has_active_incident ? '⚠️ 预警' : '✓ 正常'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Dashboard
