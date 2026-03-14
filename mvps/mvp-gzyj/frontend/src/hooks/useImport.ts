import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../api/client'

// 获取导入历史
export const useImportLogs = () => {
  return useQuery({
    queryKey: ['import-logs'],
    queryFn: async () => {
      return client.get<{ total: number; items: { id: number; batch_id: string; file_name: string; total_rows: number; success_rows: number; failed_rows: number; skipped_rows: number; status: string; created_at: string }[] }>('/api/import/logs')
    }
  })
}

// 上传文件
export const useUploadFile = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      
      return client.post<{ batch_id: string; total_rows: number; success_rows: number; failed_rows: number; skipped_rows: number; status: string; errors: { row: number; error: string }[] }>('/api/import/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-logs'] })
      queryClient.invalidateQueries({ queryKey: ['valves'] })
    }
  })
}
