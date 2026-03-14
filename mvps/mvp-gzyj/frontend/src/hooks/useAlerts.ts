import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../api/client'
import type { Incident, AlertRecord } from '../types'

// 获取事件列表
export const useIncidents = (params?: { site_code?: string; status?: string }) => {
  return useQuery({
    queryKey: ['incidents', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params?.site_code) searchParams.append('site_code', params.site_code)
      if (params?.status) searchParams.append('status', params.status)
      
      return client.get<{ total: number; items: Incident[] }>(`/api/alerts/incidents?${searchParams.toString()}`)
    },
    refetchInterval: 30000
  })
}

// 获取事件详情
export const useIncident = (id: number) => {
  return useQuery({
    queryKey: ['incidents', id],
    queryFn: async () => {
      return client.get<Incident & { event_logs: { id: number; event_type: string; event_time: string; pv_value?: number; delta_value?: number }[] }>(`/api/alerts/incidents/${id}`)
    },
    enabled: !!id
  })
}

// 获取活跃事件汇总
export const useActiveSummary = () => {
  return useQuery({
    queryKey: ['active-summary'],
    queryFn: async () => {
      return client.get<{ active_count: number; sites_affected: string[]; latest_incident?: { id: number; site_code: string; valve_id: string; triggered_at: string } }>('/api/alerts/active-summary')
    },
    refetchInterval: 30000
  })
}

// 获取告警记录
export const useAlertRecords = (params?: { site_code?: string; is_read?: boolean }) => {
  return useQuery({
    queryKey: ['alert-records', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params?.site_code) searchParams.append('site_code', params.site_code)
      if (params?.is_read !== undefined) searchParams.append('is_read', String(params.is_read))
      
      return client.get<{ total: number; unread_count: number; items: AlertRecord[] }>(`/api/alerts/records?${searchParams.toString()}`)
    },
    refetchInterval: 30000
  })
}

// 标记单条已读
export const useMarkRecordRead = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: number) => {
      return client.patch(`/api/alerts/records/${id}/read`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-records'] })
    }
  })
}

// 标记全部已读
export const useMarkAllRead = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      return client.patch('/api/alerts/records/read-all')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-records'] })
    }
  })
}

// 关闭事件
export const useCloseIncident = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: number) => {
      return client.post(`/api/alerts/incidents/${id}/close`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      queryClient.invalidateQueries({ queryKey: ['active-summary'] })
    }
  })
}
