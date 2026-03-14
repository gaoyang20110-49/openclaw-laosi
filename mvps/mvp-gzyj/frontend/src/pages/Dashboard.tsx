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
  
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">监控看板</h2>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">
            活跃预警: <span className="text-red-500 font-bold">{summary?.active_incidents || 0}</span>
          </span>
          <span className="text-sm text-gray-500">
            总阀门数: {summary?.total_valves || 0}
          </span>
        </div>
      </div>
      
      {/* 机房选择 */}
      <div className="bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          选择机房
        </label>
        <select
          value={selectedSite}
          onChange={(e) => setSelectedSite(e.target.value)}
          className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          {sites.map(site => (
            <option key={site} value={site}>{site}</option>
          ))}
        </select>
      </div>
      
      {/* 阀门卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {valves.map(valve => (
          <div
            key={valve.valve_id}
            className={`bg-white rounded-lg shadow p-4 border-l-4 ${
              valve.has_active_incident
                ? 'border-orange-500'
                : valve.is_important
                ? 'border-blue-500'
                : 'border-green-500'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {valve.is_important && <span className="text-yellow-500 mr-1">⭐</span>}
                  {valve.valve_id}
                </h3>
                <p className="text-sm text-gray-500">{valve.valve_type}</p>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${
                valve.has_active_incident
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-green-100 text-green-800'
              }`}>
                {valve.has_active_incident ? '预警' : '正常'}
              </span>
            </div>
            
            <div className="mt-4">
              <div className="flex items-baseline">
                <span className="text-3xl font-bold text-gray-900">
                  {valve.pv_value?.toFixed(1) || '-'}
                </span>
                <span className="ml-1 text-gray-500">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {valve.timestamp ? new Date(valve.timestamp).toLocaleString() : '无数据'}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      {/* 阀门明细表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-800">阀门数据明细</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                阀门编号
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                重要
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                类型
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                PV值
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {valves.map(valve => (
              <tr key={valve.valve_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {valve.valve_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {valve.is_important ? '⭐' : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {valve.valve_type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {valve.pv_value?.toFixed(1) || '-'}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    valve.has_active_incident
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {valve.has_active_incident ? '预警' : '正常'}
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
