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
    // 查询会自动触发，因为 useHistoryTimeseries 依赖这些参数
  }
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">历史数据查询</h2>
      
      {/* 查询条件 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">机房</label>
            <select
              value={selectedSite}
              onChange={(e) => {
                setSelectedSite(e.target.value)
                setSelectedValve('')
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">请选择机房</option>
              {sites.map(site => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">阀门</label>
            <input
              type="text"
              value={selectedValve}
              onChange={(e) => setSelectedValve(e.target.value)}
              placeholder="输入阀门编号"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={handleQuery}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            查询
          </button>
        </div>
      </div>
      
      {/* 曲线图 */}
      {data.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4">
            {historyData?.valve_name || historyData?.valve_id} - PV开度趋势
          </h3>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'PV值']}
                />
                <ReferenceLine y={80} stroke="red" strokeDasharray="3 3" label="阈值80%" />
                <Line 
                  type="monotone" 
                  dataKey="pv_value" 
                  stroke="#2563eb" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      
      {/* 数据明细表 */}
      {data.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-800">数据明细</h3>
            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">
              导出CSV
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PV值</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((point, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(point.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                      {point.pv_value.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {data.length === 0 && selectedSite && selectedValve && startTime && endTime && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          该时间段内无数据
        </div>
      )}
    </div>
  )
}

export default History
