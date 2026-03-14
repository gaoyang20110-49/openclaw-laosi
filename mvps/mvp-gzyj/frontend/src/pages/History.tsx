import React, { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useSites, useHistoryTimeseries } from '../hooks/useValves'

const History: React.FC = () => {
  const [selectedSite, setSelectedSite] = useState('')
  const [selectedValve, setSelectedValve] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  const { data: sitesData } = useSites()
  const { data: historyData } = useHistoryTimeseries(
    selectedSite,
    selectedValve,
    startTime,
    endTime
  )

  const sites = sitesData?.sites || []
  const data = historyData?.data || []

  // 查询按钮
  const handleQuery = () => {
    if (!selectedSite || !selectedValve || !startTime || !endTime) {
      alert('请填写完整的查询条件')
      return
    }
  }

  return (
    <div className="space-y-8 animate-fadeInUp">
      {/* 页面标题 */}
      <div className="animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
        <h2 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
          历史数据查询
        </h2>
        <p className="text-gray-400 mt-2">查询和查看阀门历史数据趋势</p>
      </div>

      {/* 查询条件 */}
      <div className="glass-card p-6 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center space-x-2 mb-6">
          <span className="text-2xl">🔍</span>
          <h3 className="text-xl font-bold text-gray-800">查询条件</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div>
            <label className="block text-lg font-semibold text-gray-800 mb-2">
              机房 <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSite}
              onChange={(e) => {
                setSelectedSite(e.target.value)
                setSelectedValve('')
              }}
              className="input-modern"
            >
              <option value="">请选择机房</option>
              {sites.map(site => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-lg font-semibold text-gray-800 mb-2">
              阀门 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={selectedValve}
              onChange={(e) => setSelectedValve(e.target.value)}
              placeholder="输入阀门编号"
              className="input-modern"
            />
          </div>
          <div>
            <label className="block text-lg font-semibold text-gray-800 mb-2">
              开始时间 <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="input-modern"
            />
          </div>
          <div>
            <label className="block text-lg font-semibold text-gray-800 mb-2">
              结束时间 <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="input-modern"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleQuery}
            className="btn-gradient"
          >
            🔍 开始查询
          </button>
        </div>
      </div>

      {/* 查询结果 */}
      {data.length > 0 && (
        <div className="space-y-8 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
          {/* 统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="data-card data-card-primary">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-white/80 font-medium">数据点数</p>
                  <p className="text-4xl font-bold mt-2">{data.length}</p>
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-3xl animate-float">
                  📊
                </div>
              </div>
            </div>
            <div className="data-card data-card-success">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-white/80 font-medium">平均PV值</p>
                  <p className="text-4xl font-bold mt-2">
                    {(data.reduce((sum, p) => sum + p.pv_value, 0) / data.length).toFixed(1)}%
                  </p>
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-3xl animate-float" style={{ animationDelay: '0.5s' }}>
                  📈
                </div>
              </div>
            </div>
            <div className="data-card data-card-warning">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-white/80 font-medium">最大PV值</p>
                  <p className="text-4xl font-bold mt-2">
                    {Math.max(...data.map(p => p.pv_value)).toFixed(1)}%
                  </p>
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-3xl animate-float" style={{ animationDelay: '1s' }}>
                  ⚡
                </div>
              </div>
            </div>
          </div>

          {/* 曲线图 */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-800">
                  {historyData?.valve_name || historyData?.valve_id}
                </h3>
                <p className="text-gray-500 mt-1">PV开度趋势图</p>
              </div>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-gray-600">阈值线 (80%)</span>
                </div>
              </div>
            </div>
            <div className="h-96 bg-gradient-to-br from-white to-gray-50 rounded-2xl p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis domain={[0, 100]} stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleString('zh-CN')}
                    formatter={(value: number) => [`${value.toFixed(2)}%`, 'PV值']}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="5 5" label="阈值80%" />
                  <Line
                    type="monotone"
                    dataKey="pv_value"
                    stroke="url(#gradientLine)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                  <defs>
                    <linearGradient id="gradientLine" x1="0%" y1="0%" x2="0%" y2="0%">
                      <stop offset="0%" stopColor="#667eea" />
                      <stop offset="100%" stopColor="#764ba2" />
                    </linearGradient>
                  </defs>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 数据明细表 */}
          <div className="table-modern">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">数据明细</h3>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-500">共 {data.length} 条记录</span>
                <button className="btn-gradient text-sm">
                  📥 导出CSV
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="px-6 py-4 text-left">时间</th>
                    <th className="px-6 py-4 text-left">PV值</th>
                    <th className="px-6 py-4 text-left">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((point, idx) => (
                    <tr key={idx} className="hover:bg-purple-50/30 transition-colors">
                      <td className="px-6 py-4 text-gray-700">
                        {new Date(point.timestamp).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                point.pv_value >= 80
                                  ? 'bg-gradient-to-r from-red-500 to-orange-500'
                                  : 'bg-gradient-to-r from-green-500 to-emerald-500'
                              }`}
                              style={{ width: `${point.pv_value}%` }}
                            ></div>
                          </div>
                          <span className="font-bold text-gray-900">{point.pv_value.toFixed(2)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {point.pv_value >= 80 ? (
                          <span className="status-badge status-badge-warning">⚠️ 超限</span>
                        ) : (
                          <span className="status-badge status-badge-success">✓ 正常</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 无数据提示 */}
      {data.length === 0 && selectedSite && selectedValve && startTime && endTime && (
        <div className="glass-card p-12 text-center animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-bold text-gray-700">该时间段内无数据</h3>
          <p className="text-gray-500 mt-2">请尝试调整查询时间范围</p>
        </div>
      )}
    </div>
  )
}

export default History
