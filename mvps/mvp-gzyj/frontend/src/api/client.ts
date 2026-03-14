import axios, { AxiosResponse } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

// 创建 axios 实例
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
axiosInstance.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证token等
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 - 直接返回 data
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data
  },
  (error) => {
    // 统一错误处理
    const message = error.response?.data?.detail || error.message || '请求失败'
    console.error('API Error:', message)
    return Promise.reject(new Error(message))
  }
)

// 包装 client 对象，提供类型化的请求方法
const client = {
  get: <T = any>(url: string, config?: any): Promise<T> => axiosInstance.get(url, config),
  post: <T = any>(url: string, data?: any, config?: any): Promise<T> => axiosInstance.post(url, data, config),
  put: <T = any>(url: string, data?: any, config?: any): Promise<T> => axiosInstance.put(url, data, config),
  patch: <T = any>(url: string, data?: any, config?: any): Promise<T> => axiosInstance.patch(url, data, config),
  delete: <T = any>(url: string, config?: any): Promise<T> => axiosInstance.delete(url, config)
}

export default client
