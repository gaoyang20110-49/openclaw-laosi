import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../api/client'
import type { AlertRule } from '../types'

// 获取规则列表
export const useRules = (params?: { site_code?: string; enabled?: boolean }) => {
  return useQuery({
    queryKey: ['rules', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params?.site_code) searchParams.append('site_code', params.site_code)
      if (params?.enabled !== undefined) searchParams.append('enabled', String(params.enabled))
      
      return client.get<{ total: number; items: AlertRule[] }>(`/api/rules?${searchParams.toString()}`)
    }
  })
}

// 获取规则详情
export const useRule = (id: number) => {
  return useQuery({
    queryKey: ['rules', id],
    queryFn: async () => {
      return client.get<AlertRule>(`/api/rules/${id}`)
    },
    enabled: !!id
  })
}

// 创建规则
export const useCreateRule = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: Partial<AlertRule>) => {
      return client.post<AlertRule>('/api/rules', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
    }
  })
}

// 更新规则
export const useUpdateRule = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<AlertRule> }) => {
      return client.put<AlertRule>(`/api/rules/${id}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
    }
  })
}

// 删除规则
export const useDeleteRule = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: number) => {
      return client.delete(`/api/rules/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
    }
  })
}

// 启用/停用规则
export const useToggleRule = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      return client.patch<AlertRule>(`/api/rules/${id}/toggle`, { enabled })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
    }
  })
}
