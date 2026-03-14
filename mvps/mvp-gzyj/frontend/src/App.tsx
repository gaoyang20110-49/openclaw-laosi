import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// 页面组件
import Dashboard from './pages/Dashboard'
import Import from './pages/Import'
import AlertCenter from './pages/AlertCenter'
import RuleConfig from './pages/RuleConfig'
import History from './pages/History'

// 创建 QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

// 侧边栏组件
const Sidebar: React.FC = () => {
  const location = useLocation()

  const navItems = [
    { path: '/', label: '监控看板', icon: '📊', color: 'from-blue-500 to-cyan-500' },
    { path: '/import', label: '数据导入', icon: '📁', color: 'from-purple-500 to-pink-500' },
    { path: '/alerts', label: '预警中心', icon: '🚨', color: 'from-orange-500 to-red-500' },
    { path: '/rules', label: '规则配置', icon: '⚙️', color: 'from-emerald-500 to-teal-500' },
    { path: '/history', label: '历史查询', icon: '📈', color: 'from-indigo-500 to-violet-500' },
  ]

  return (
    <aside className="w-72 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white min-h-screen shadow-2xl relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-64 h-64 bg-purple-500 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
      </div>

      {/* Logo 区域 */}
      <div className="relative z-10 p-8 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30 animate-float">
            <span className="text-2xl">⚡</span>
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              IDC预警系统
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">旁通阀异动监测</p>
          </div>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="relative z-10 p-6 space-y-2">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center px-5 py-3.5 rounded-xl transition-all duration-300 group ${
              location.pathname === item.path
                ? 'bg-gradient-to-r ' + item.color + ' shadow-lg text-white transform scale-105'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="text-2xl mr-4 transition-transform duration-300 group-hover:scale-110">
              {item.icon}
            </span>
            <span className="font-medium">{item.label}</span>
            {location.pathname === item.path && (
              <div className="absolute right-3 w-2 h-2 bg-white rounded-full animate-pulse-ring"></div>
            )}
          </Link>
        ))}
      </nav>

      {/* 底部信息 */}
      <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-white/10 bg-gradient-to-t from-black/30 to-transparent">
        <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>系统运行正常</span>
        </div>
      </div>
    </aside>
  )
}

// 顶部栏组件
const TopBar: React.FC = () => {
  return (
    <header className="bg-white/95 backdrop-blur-xl border-b border-gray-200 px-8 py-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-gradient">
            IDC机房旁通阀异动故障预警系统
          </h2>
        </div>

        <div className="flex items-center space-x-6">
          {/* 实时模式指示器 */}
          <div className="flex items-center px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
            <div className="relative">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-50"></div>
            </div>
            <span className="ml-3 text-sm font-semibold text-green-700">实时监控中</span>
          </div>

          {/* 预警铃铛 */}
          <button className="relative p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 hover:scale-105 group">
            <span className="text-2xl group-hover:animate-bounce">🔔</span>
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg animate-pulse">
              0
            </span>
          </button>

          {/* 时间显示 */}
          <div className="hidden md:flex items-center px-4 py-2 bg-gray-50 rounded-xl border border-gray-200">
            <span className="text-xl mr-2">🕐</span>
            <span className="text-sm font-medium text-gray-700">
              {new Date().toLocaleTimeString('zh-CN')}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

// 布局组件
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

// 主应用组件
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/import" element={<Import />} />
            <Route path="/alerts" element={<AlertCenter />} />
            <Route path="/rules" element={<RuleConfig />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  )
}

export default App
