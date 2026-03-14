import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../api/client'
import type { Valve, LatestValveData, DashboardSummary, RealtimeValveData } from '../types'

// 获取阀门列表
export const useValves = (params?: { site_code?: string; valve_type?: string; is_important?: boolean }) => {
  return useQuery({
    queryKey: ['valves', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params?.site_code) searchParams.append('site_code', params.site_code)
      if (params?.valve_type) searchParams.append('valve_type', params.valve_type)
      if (params?.is_important !== undefined) searchParams.append('is_important', String(params.is_important))
      
      return client.get<{ total: number; items: Valve[] }>(`/api/valves?${searchParams.toString()}`)
    }
  })
}

// 获取机房列表
export const useSites = () => {
  return useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      return client.get<{ sites: string[] }>('/api/valves/sites')
    }
  })
}

// 更新重要性标记
export const useUpdateImportance = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ site_code, valve_id, is_important }: { site_code: string; valve_id: string; is_important: boolean }) => {
      return client.patch(`/api/valves/${site_code}/${valve_id}/importance`, { is_important })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valves'] })
    }
  })
}

// 获取最新PV值
export const useLatestTimeseries = (site_code: string) => {
  return useQuery({
    queryKey: ['timeseries', 'latest', site_code],
    queryFn: async () => {
      return client.get<{ site_code: string; effective_time: string; valves: LatestValveData[] }>(`/api/timeseries/latest?site_code=${site_code}`)
    },
    refetchInterval: 30000 // 30秒自动刷新
  })
}

// 获取历史数据
export const useHistoryTimeseries = (site_code: string, valve_id: string, start_time: string, end_time: string) => {
  return useQuery({
    queryKey: ['timeseries', 'history', site_code, valve_id, start_time, end_time],
    queryFn: async () => {
      const params = new URLSearchParams({ site_code, valve_id, start_time, end_time })
      return client.get<{ site_code: string; valve_id: string; valve_name?: string; data: { timestamp: string; pv_value: number }[] }>(`/api/timeseries/history?${params.toString()}`)
    },
    enabled: !!site_code && !!valve_id && !!start_time && !!end_time
  })
}

// 获取看板汇总
export const useDashboardSummary = () => {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      return client.get<DashboardSummary>('/api/dashboard/summary')
    },
    refetchInterval: 30000
  })
}

// 获取实时监控数据
export const useDashboardRealtime = (site_code?: string) => {
  return useQuery({
    queryKey: ['dashboard', 'realtime', site_code],
    queryFn: async () => {
      const params = site_code ? `?site_code=${site_code}` : ''
      return client.get<{ site_code: string; effective_time: string; valves: RealtimeValveData[] }>(`/api/dashboard/realtime${params}`)
    },
    refetchInterval: 30000
  })
}
