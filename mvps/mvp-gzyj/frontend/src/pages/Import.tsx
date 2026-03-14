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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">数据导入</h2>
      
      {/* 文件上传区 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-800 mb-4">上传文件</h3>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <div className="text-gray-600">
            {isDragActive ? (
              <p>拖拽文件到此处...</p>
            ) : (
              <>
                <p className="text-lg mb-2">📁</p>
                <p>拖拽文件至此，或点击选择文件</p>
                <p className="text-sm text-gray-400 mt-2">
                  支持 .xlsx / .xls / .csv，单次上限 5万行
                </p>
              </>
            )}
          </div>
        </div>
        
        {/* 上传结果 */}
        {uploadResult && (
          <div className={`mt-4 p-4 rounded-lg ${
            uploadResult.status === 'completed' ? 'bg-green-50 border border-green-200' :
            uploadResult.status === 'partial' ? 'bg-yellow-50 border border-yellow-200' :
            'bg-red-50 border border-red-200'
          }`}>
            <h4 className="font-medium mb-2">导入结果</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">总条数:</span>
                <span className="ml-2 font-medium">{uploadResult.total_rows}</span>
              </div>
              <div>
                <span className="text-green-600">成功:</span>
                <span className="ml-2 font-medium">{uploadResult.success_rows}</span>
              </div>
              <div>
                <span className="text-yellow-600">跳过:</span>
                <span className="ml-2 font-medium">{uploadResult.skipped_rows}</span>
              </div>
              <div>
                <span className="text-red-600">失败:</span>
                <span className="ml-2 font-medium">{uploadResult.failed_rows}</span>
              </div>
            </div>
            
            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-gray-600 mb-2">错误明细（前10条）:</p>
                <div className="max-h-32 overflow-y-auto text-xs">
                  {uploadResult.errors.slice(0, 10).map((err: any, idx: number) => (
                    <p key={idx} className="text-red-600">{err.error}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* 导入历史 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-800">导入历史</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">文件名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">成功</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">跳过</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">失败</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.slice(0, 5).map(log => (
              <tr key={log.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.file_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{log.success_rows}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">{log.skipped_rows}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{log.failed_rows}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    log.status === 'completed' ? 'bg-green-100 text-green-800' :
                    log.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {log.status === 'completed' ? '完成' :
                     log.status === 'partial' ? '部分成功' :
                     log.status === 'processing' ? '处理中' : '失败'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* 阀门档案 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-800">阀门档案</h3>
          {selectedValves.size > 0 && (
            <div className="flex space-x-2">
              <button
                onClick={() => handleBatchImportance(true)}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                批量设为重要
              </button>
              <button
                onClick={() => handleBatchImportance(false)}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
              >
                批量取消重要
              </button>
            </div>
          )}
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedValves(new Set(valves.map(v => `${v.site_code}/${v.valve_id}`)))
                    } else {
                      setSelectedValves(new Set())
                    }
                  }}
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">阀门编号</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">机房</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">重要性</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {valves.map(valve => (
              <tr key={`${valve.site_code}/${valve.valve_id}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selectedValves.has(`${valve.site_code}/${valve.valve_id}`)}
                    onChange={() => toggleValveSelection(valve.site_code, valve.valve_id)}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {valve.valve_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{valve.site_code}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{valve.valve_type}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleToggleImportance(valve.site_code, valve.valve_id, valve.is_important)}
                    className={`px-3 py-1 text-sm rounded ${
                      valve.is_important
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-600'
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
