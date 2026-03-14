import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useImportLogs, useUploadFile } from '../hooks/useImport'
import { useValves, useUpdateImportance } from '../hooks/useValves'

const Import: React.FC = () => {
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [selectedValves, setSelectedValves] = useState<Set<string>>(new Set())

  const { data: logsData, refetch: refetchLogs } = useImportLogs()
  const { data: valvesData } = useValves()
  const uploadMutation = useUploadFile()
  const updateImportanceMutation = useUpdateImportance()

  const logs = logsData?.items || []
  const valves = valvesData?.items || []

  // 文件上传处理
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    try {
      const result = await uploadMutation.mutateAsync(file)
      setUploadResult(result)
      refetchLogs()
    } catch (error) {
      alert('上传失败: ' + (error as Error).message)
    }
  }, [uploadMutation, refetchLogs])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1
  })

  // 批量更新重要性
  const handleBatchImportance = async (isImportant: boolean) => {
    const promises = Array.from(selectedValves).map(key => {
      const [site_code, valve_id] = key.split('/')
      return updateImportanceMutation.mutateAsync({ site_code, valve_id, is_important: isImportant })
    })

    await Promise.all(promises)
    setSelectedValves(new Set())
  }

  // 单个更新重要性
  const handleToggleImportance = async (site_code: string, valve_id: string, currentValue: boolean) => {
    await updateImportanceMutation.mutateAsync({
      site_code,
      valve_id,
      is_important: !currentValue
    })
  }

  // 选择/取消选择阀门
  const toggleValveSelection = (site_code: string, valve_id: string) => {
    const key = `${site_code}/${valve_id}`
    const newSet = new Set(selectedValves)
    if (newSet.has(key)) {
      newSet.delete(key)
    } else {
      newSet.add(key)
    }
    setSelectedValves(newSet)
  }

  return (
    <div className="space-y-8 animate-fadeInUp">
      {/* 页面标题 */}
      <div>
        <h2 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
          数据导入
        </h2>
        <p className="text-gray-400 mt-2">上传阀门数据文件进行导入</p>
      </div>

      {/* 文件上传区 */}
      <div className="glass-card p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-800">📁 上传文件</h3>
        </div>

        <div
          {...getRootProps()}
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-500 ${
            isDragActive
              ? 'border-purple-500 bg-gradient-to-br from-purple-500/10 to-blue-500/10 scale-105'
              : 'border-gray-300 hover:border-purple-400 bg-gradient-to-br from-gray-50 to-white'
          }`}
        >
          <input {...getInputProps()} />
          <div className="space-y-4">
            {isDragActive ? (
              <>
                <div className="text-6xl animate-bounce">📥</div>
                <p className="text-xl font-semibold text-purple-600">拖拽文件到此处</p>
              </>
            ) : (
              <>
                <div className="text-6xl animate-float">📄</div>
                <p className="text-xl font-semibold text-gray-700">拖拽文件至此，或点击选择</p>
                <p className="text-gray-400">
                  支持 <span className="font-semibold text-purple-600">.xlsx</span> /{' '}
                  <span className="font-semibold text-purple-600">.xls</span> /{' '}
                  <span className="font-semibold text-purple-600">.csv</span>
                </p>
                <p className="text-sm text-gray-400">单次上限 5万行</p>
              </>
            )}
          </div>
        </div>

        {/* 上传结果 */}
        {uploadResult && (
          <div className={`mt-8 p-6 rounded-2xl border-2 ${
            uploadResult.status === 'completed'
              ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300'
              : uploadResult.status === 'partial'
              ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-300'
              : 'bg-gradient-to-br from-red-50 to-pink-50 border-red-300'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xl font-bold">
                {uploadResult.status === 'completed' ? '✅ 导入完成' :
                 uploadResult.status === 'partial' ? '⚠️ 部分成功' : '❌ 导入失败'}
              </h4>
              <span className={`status-badge ${
                uploadResult.status === 'completed' ? 'status-badge-success' :
                uploadResult.status === 'partial' ? 'status-badge-warning' : 'status-badge-warning'
              }`}>
                {uploadResult.status === 'completed' ? '成功' :
                 uploadResult.status === 'partial' ? '部分成功' : '失败'}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/50 rounded-xl p-4">
                <p className="text-sm text-gray-500">总条数</p>
                <p className="text-2xl font-bold text-gray-900">{uploadResult.total_rows}</p>
              </div>
              <div className="bg-white/50 rounded-xl p-4">
                <p className="text-sm text-green-600">成功</p>
                <p className="text-2xl font-bold text-green-600">{uploadResult.success_rows}</p>
              </div>
              <div className="bg-white/50 rounded-xl p-4">
                <p className="text-sm text-yellow-600">跳过</p>
                <p className="text-2xl font-bold text-yellow-600">{uploadResult.skipped_rows}</p>
              </div>
              <div className="bg-white/50 rounded-xl p-4">
                <p className="text-sm text-red-600">失败</p>
                <p className="text-2xl font-bold text-red-600">{uploadResult.failed_rows}</p>
              </div>
            </div>

            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-semibold text-gray-700 mb-3">错误明细（前10条）:</p>
                <div className="max-h-40 overflow-y-auto bg-white/50 rounded-xl p-4">
                  {uploadResult.errors.slice(0, 10).map((err: any, idx: number) => (
                    <p key={idx} className="text-sm text-red-600 mb-2">• {err.error}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 导入历史 */}
      <div className="table-modern">
        <div className="px-8 py-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-800">📋 导入历史</h3>
            <span className="text-sm text-gray-500">最近 5 条记录</span>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-6 py-4 text-left">时间</th>
              <th className="px-6 py-4 text-left">文件名</th>
              <th className="px-6 py-4 text-left">成功</th>
              <th className="px-6 py-4 text-left">跳过</th>
              <th className="px-6 py-4 text-left">失败</th>
              <th className="px-6 py-4 text-left">状态</th>
            </tr>
          </thead>
          <tbody>
            {logs.slice(0, 5).map(log => (
              <tr key={log.id} className="hover:bg-purple-50/30 transition-colors">
                <td className="px-6 py-4 text-gray-700">
                  {new Date(log.created_at).toLocaleString('zh-CN')}
                </td>
                <td className="px-6 py-4">
                  <span className="font-semibold text-gray-900">{log.file_name}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-semibold">
                    {log.success_rows}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full font-semibold">
                    {log.skipped_rows}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-semibold">
                    {log.failed_rows}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`status-badge ${
                    log.status === 'completed' ? 'status-badge-success' :
                    log.status === 'partial' ? 'status-badge-warning' : 'status-badge-warning'
                  }`}>
                    {log.status === 'completed' ? '✓ 完成' :
                     log.status === 'partial' ? '⚠️ 部分成功' :
                     log.status === 'processing' ? '⏳ 处理中' : '✗ 失败'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 阀门档案 */}
      <div className="table-modern">
        <div className="px-8 py-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-800">🔧 阀门档案</h3>
              <p className="text-sm text-gray-500 mt-1">管理已导入的阀门信息</p>
            </div>
            {selectedValves.size > 0 && (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-500">已选择 {selectedValves.size} 项</span>
                <button
                  onClick={() => handleBatchImportance(true)}
                  className="btn-gradient"
                >
                  ⭐ 设为重要
                </button>
                <button
                  onClick={() => handleBatchImportance(false)}
                  className="btn-gradient-secondary"
                >
                  取消重要
                </button>
              </div>
            )}
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-6 py-4">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedValves(new Set(valves.map(v => `${v.site_code}/${v.valve_id}`)))
                    } else {
                      setSelectedValves(new Set())
                    }
                  }}
                />
              </th>
              <th className="px-6 py-4 text-left">阀门编号</th>
              <th className="px-6 py-4 text-left">机房</th>
              <th className="px-6 py-4 text-left">类型</th>
              <th className="px-6 py-4 text-left">重要性</th>
            </tr>
          </thead>
          <tbody>
            {valves.map(valve => (
              <tr key={`${valve.site_code}/${valve.valve_id}`} className="hover:bg-purple-50/30 transition-colors">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    checked={selectedValves.has(`${valve.site_code}/${valve.valve_id}`)}
                    onChange={() => toggleValveSelection(valve.site_code, valve.valve_id)}
                  />
                </td>
                <td className="px-6 py-4">
                  <span className="font-semibold text-gray-900">{valve.valve_id}</span>
                </td>
                <td className="px-6 py-4 text-gray-700">{valve.site_code}</td>
                <td className="px-6 py-4 text-gray-700">{valve.valve_type}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleToggleImportance(valve.site_code, valve.valve_id, valve.is_important)}
                    className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 ${
                      valve.is_important
                        ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-lg shadow-yellow-500/30 hover:shadow-xl hover:scale-105'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {valve.is_important ? '⭐ 重要' : '普通'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Import
