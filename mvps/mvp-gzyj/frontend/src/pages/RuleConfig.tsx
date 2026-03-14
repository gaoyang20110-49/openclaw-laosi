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
    <div className="space-y-8 animate-fadeInUp">
      {/* 页面标题 */}
      <div className="flex items-center justify-between animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
        <div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            预警规则配置
          </h2>
          <p className="text-gray-400 mt-2">定义和管理系统预警规则</p>
        </div>
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
          className="btn-gradient"
        >
          + 新建规则
        </button>
      </div>

      {/* 规则统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
        <div className="data-card data-card-primary">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-white/80 font-medium">总规则数</p>
              <p className="text-4xl font-bold mt-2">{rules.length}</p>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-3xl animate-float">
              ⚙️
            </div>
          </div>
        </div>
        <div className="data-card data-card-success">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-white/80 font-medium">启用中</p>
              <p className="text-4xl font-bold mt-2">{rules.filter(r => r.enabled).length}</p>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-3xl animate-float" style={{ animationDelay: '0.5s' }}>
              ✓
            </div>
          </div>
        </div>
        <div className="data-card data-card-info">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-white/80 font-medium">已停用</p>
              <p className="text-4xl font-bold mt-2">{rules.filter(r => !r.enabled).length}</p>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-3xl animate-float" style={{ animationDelay: '1s' }}>
              🚫
            </div>
          </div>
        </div>
      </div>

      {/* 规则列表 */}
      <div className="table-modern animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
        <div className="px-8 py-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-800">规则列表</h3>
            <span className="text-sm text-gray-500">共 {rules.length} 条规则</span>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-6 py-4 text-left">规则名称</th>
              <th className="px-6 py-4 text-left">场景</th>
              <th className="px-6 py-4 text-left">适用机房</th>
              <th className="px-6 py-4 text-left">阀门类型</th>
              <th className="px-6 py-4 text-left">状态</th>
              <th className="px-6 py-4 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, index) => (
              <tr key={rule.id} className="hover:bg-purple-50/30 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-bold text-gray-900">{rule.rule_name}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-lg font-semibold ${
                    rule.scene_type === 'A'
                      ? 'bg-gradient-to-r from-orange-400 to-red-400 text-white'
                      : 'bg-gradient-to-r from-blue-400 to-cyan-400 text-white'
                  }`}>
                    <span className="mr-2 text-lg">
                      {rule.scene_type === 'A' ? '📊' : '📈'}
                    </span>
                    场景{rule.scene_type}
                    <span className="ml-2 opacity-80">
                      ({rule.scene_type === 'A' ? '持续高位' : '剧烈波动'})
                    </span>
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-700">
                  {rule.site_code || <span className="text-gray-400">全部机房</span>}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    rule.importance_filter === 'all'
                      ? 'bg-gray-100 text-gray-700'
                      : rule.importance_filter === 'important'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {rule.importance_filter === 'all' ? '全部阀门' :
                     rule.importance_filter === 'important' ? '⭐ 重要阀门' : '普通阀门'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })}
                    className={`px-4 py-1.5 rounded-lg font-semibold transition-all duration-300 ${
                      rule.enabled
                        ? 'bg-gradient-to-r from-green-400 to-emerald-400 text-white shadow-lg shadow-green-500/30 hover:scale-105'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {rule.enabled ? '✓ 启用' : '○ 停用'}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(rule)}
                      className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg text-sm font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/30 hover:scale-105"
                    >
                      ✏️ 编辑
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg text-sm font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-red-500/30 hover:scale-105"
                    >
                      🗑️ 删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 新建/编辑表单 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeInUp">
          <div className="glass-card w-full max-w-3xl max-h-[90vh] overflow-y-auto m-8">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-800">
                {editingRule ? '✏️ 编辑规则' : '➕ 新建规则'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {/* 规则名称 */}
              <div>
                <label className="block text-lg font-semibold text-gray-800 mb-2">
                  规则名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.rule_name}
                  onChange={e => setFormData({ ...formData, rule_name: e.target.value })}
                  className="input-modern"
                  placeholder="请输入规则名称"
                  required
                />
              </div>

              {/* 预警场景 */}
              <div>
                <label className="block text-lg font-semibold text-gray-800 mb-2">
                  预警场景 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`relative flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 ${
                    formData.scene_type === 'A'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      value="A"
                      checked={formData.scene_type === 'A'}
                      onChange={() => setFormData({ ...formData, scene_type: 'A', params: {} })}
                      className="mr-3 w-5 h-5 text-orange-500"
                    />
                    <div>
                      <div className="font-bold text-gray-800">场景A: 持续高位</div>
                      <div className="text-sm text-gray-500">当PV值持续高于阈值时触发预警</div>
                    </div>
                  </label>
                  <label className={`relative flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 ${
                    formData.scene_type === 'B'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      value="B"
                      checked={formData.scene_type === 'B'}
                      onChange={() => setFormData({ ...formData, scene_type: 'B', params: {} })}
                      className="mr-3 w-5 h-5 text-blue-500"
                    />
                    <div>
                      <div className="font-bold text-gray-800">场景B: 剧烈波动</div>
                      <div className="text-sm text-gray-500">当PV值在窗口内剧烈波动时触发</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 前置条件 */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg font-semibold text-gray-800 mb-2">适用机房</label>
                  <select
                    value={formData.site_code || ''}
                    onChange={e => setFormData({ ...formData, site_code: e.target.value || undefined })}
                    className="input-modern"
                  >
                    <option value="">全部机房</option>
                    <option value="IDC-A">IDC-A</option>
                    <option value="IDC-B">IDC-B</option>
                  </select>
                </div>
                <div>
                  <label className="block text-lg font-semibold text-gray-800 mb-2">阀门类型</label>
                  <select
                    value={formData.importance_filter}
                    onChange={e => setFormData({ ...formData, importance_filter: e.target.value as any })}
                    className="input-modern"
                  >
                    <option value="all">全部阀门</option>
                    <option value="important">⭐ 仅重要阀门</option>
                    <option value="normal">普通阀门</option>
                  </select>
                </div>
              </div>

              {/* 场景A参数 */}
              {formData.scene_type === 'A' && (
                <div className="bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-2xl border-2 border-orange-200">
                  <h4 className="text-xl font-bold text-orange-800 mb-4">📊 场景A参数配置</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        PV阈值 (%)
                      </label>
                      <input
                        type="number"
                        value={formData.params?.threshold || ''}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, threshold: parseFloat(e.target.value) }
                        })}
                        className="input-modern"
                        placeholder="例如：80"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        触发点数
                      </label>
                      <input
                        type="number"
                        value={formData.params?.n_points || ''}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, n_points: parseInt(e.target.value) }
                        })}
                        className="input-modern"
                        placeholder="例如：3"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        触发时长 (分钟)
                      </label>
                      <input
                        type="number"
                        value={formData.params?.n_minutes || ''}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, n_minutes: parseInt(e.target.value) }
                        })}
                        className="input-modern"
                        placeholder="例如：5"
                        required
                      />
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-white/50 rounded-xl">
                    <p className="text-sm text-orange-700">
                      <strong>💡 提示：</strong>触发点数 OR 触发时长，满足任一条件即触发预警
                    </p>
                  </div>
                </div>
              )}

              {/* 场景B参数 */}
              {formData.scene_type === 'B' && (
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-2xl border-2 border-blue-200">
                  <h4 className="text-xl font-bold text-blue-800 mb-4">📈 场景B参数配置</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        时间窗口 (分钟)
                      </label>
                      <input
                        type="number"
                        value={formData.params?.window_minutes || ''}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, window_minutes: parseInt(e.target.value) }
                        })}
                        className="input-modern"
                        placeholder="例如：10"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        波动阈值 (%)
                      </label>
                      <input
                        type="number"
                        value={formData.params?.delta_threshold || ''}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, delta_threshold: parseFloat(e.target.value) }
                        })}
                        className="input-modern"
                        placeholder="例如：30"
                        required
                      />
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-white/50 rounded-xl">
                    <p className="text-sm text-blue-700">
                      <strong>💡 提示：</strong>窗口内 max-min ≥ 波动阈值即触发预警；允许跨断点计算
                    </p>
                  </div>
                </div>
              )}

              {/* 按钮 */}
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-8 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all duration-300"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-gradient"
                >
                  ✓ 保存规则
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
