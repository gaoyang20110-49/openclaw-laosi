import React, { useState } from 'react'
import { useRules, useCreateRule, useUpdateRule, useDeleteRule, useToggleRule } from '../hooks/useRules'
import type { AlertRule } from '../types'

const RuleConfig: React.FC = () => {
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [formData, setFormData] = useState<Partial<AlertRule>>({
    rule_name: '',
    scene_type: 'A',
    site_code: undefined,
    valve_type_filter: undefined,
    importance_filter: 'all',
    enabled: true,
    params: {}
  })
  
  const { data: rulesData } = useRules()
  const createMutation = useCreateRule()
  const updateMutation = useUpdateRule()
  const deleteMutation = useDeleteRule()
  const toggleMutation = useToggleRule()
  
  const rules = rulesData?.items || []
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingRule) {
        await updateMutation.mutateAsync({ id: editingRule.id, data: formData })
      } else {
        await createMutation.mutateAsync(formData)
      }
      
      setShowForm(false)
      setEditingRule(null)
      setFormData({
        rule_name: '',
        scene_type: 'A',
        site_code: undefined,
        valve_type_filter: undefined,
        importance_filter: 'all',
        enabled: true,
        params: {}
      })
    } catch (error) {
      alert('保存失败: ' + (error as Error).message)
    }
  }
  
  const handleEdit = (rule: AlertRule) => {
    setEditingRule(rule)
    setFormData(rule)
    setShowForm(true)
  }
  
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此规则吗？')) return
    
    try {
      await deleteMutation.mutateAsync(id)
    } catch (error) {
      alert('删除失败: ' + (error as Error).message)
    }
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">预警规则配置</h2>
        <button
          onClick={() => {
            setEditingRule(null)
            setFormData({
              rule_name: '',
              scene_type: 'A',
              site_code: undefined,
              valve_type_filter: undefined,
              importance_filter: 'all',
              enabled: true,
              params: {}
            })
            setShowForm(true)
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + 新建规则
        </button>
      </div>
      
      {/* 规则列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">规则名称</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">场景</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">适用机房</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">阀门类型</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rules.map(rule => (
              <tr key={rule.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {rule.rule_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  场景{rule.scene_type}
                  {rule.scene_type === 'A' ? ' (持续高位)' : ' (剧烈波动)'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {rule.site_code || '全部机房'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {rule.importance_filter === 'all' ? '全部阀门' :
                   rule.importance_filter === 'important' ? '仅重要阀门' : '仅非重要阀门'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })}
                    className={`px-2 py-1 text-xs rounded-full ${
                      rule.enabled
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {rule.enabled ? '启用' : '停用'}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                  <button
                    onClick={() => handleEdit(rule)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* 新建/编辑表单 */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-800">
                {editingRule ? '编辑规则' : '新建规则'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* 规则名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  规则名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.rule_name}
                  onChange={e => setFormData({ ...formData, rule_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              {/* 预警场景 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  预警场景 <span className="text-red-500">*</span>
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="A"
                      checked={formData.scene_type === 'A'}
                      onChange={() => setFormData({ ...formData, scene_type: 'A', params: {} })}
                      className="mr-2"
                    />
                    场景A: 持续高位
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="B"
                      checked={formData.scene_type === 'B'}
                      onChange={() => setFormData({ ...formData, scene_type: 'B', params: {} })}
                      className="mr-2"
                    />
                    场景B: 剧烈波动
                  </label>
                </div>
              </div>
              
              {/* 前置条件 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">适用机房</label>
                  <select
                    value={formData.site_code || ''}
                    onChange={e => setFormData({ ...formData, site_code: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">全部机房</option>
                    <option value="IDC-A">IDC-A</option>
                    <option value="IDC-B">IDC-B</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">阀门类型</label>
                  <select
                    value={formData.importance_filter}
                    onChange={e => setFormData({ ...formData, importance_filter: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="all">全部阀门</option>
                    <option value="important">仅重要阀门</option>
                    <option value="normal">仅非重要阀门</option>
                  </select>
                </div>
              </div>
              
              {/* 场景A参数 */}
              {formData.scene_type === 'A' && (
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <h4 className="font-medium text-gray-700">场景A参数</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">PV阈值 (%)</label>
                      <input
                        type="number"
                        value={formData.params?.threshold || ''}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, threshold: parseFloat(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">触发点数</label>
                      <input
                        type="number"
                        value={formData.params?.n_points || ''}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, n_points: parseInt(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">触发时长 (分钟)</label>
                      <input
                        type="number"
                        value={formData.params?.n_minutes || ''}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, n_minutes: parseInt(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">提示：触发点数 OR 触发时长，满足任一即触发</p>
                </div>
              )}
              
              {/* 场景B参数 */}
              {formData.scene_type === 'B' && (
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <h4 className="font-medium text-gray-700">场景B参数</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">时间窗口 (分钟)</label>
                      <input
                        type="number"
                        value={formData.params?.window_minutes || ''}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, window_minutes: parseInt(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">波动阈值 (%)</label>
                      <input
                        type="number"
                        value={formData.params?.delta_threshold || ''}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, delta_threshold: parseFloat(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">提示：窗口内 max-min ≥ 波动阈值即触发；允许跨断点</p>
                </div>
              )}
              
              {/* 按钮 */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  保存规则
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default RuleConfig
