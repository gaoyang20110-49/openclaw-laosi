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
    { path: '/', label: '监控看板', icon: '📊' },
    { path: '/import', label: '数据导入', icon: '📁' },
    { path: '/alerts', label: '预警中心', icon: '🚨' },
    { path: '/rules', label: '规则配置', icon: '⚙️' },
    { path: '/history', label: '历史查询', icon: '📈' },
  ]
  
  return (
    <aside className="w-64 bg-gray-800 text-white min-h-screen">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold">IDC旁通阀预警</h1>
        <p className="text-xs text-gray-400 mt-1">异动故障预警工具</p>
      </div>
      <nav className="p-4">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center px-4 py-3 rounded-lg mb-2 transition-colors ${
              location.pathname === item.path
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <span className="mr-3">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  )
}

// 顶部栏组件
const TopBar: React.FC = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">
          IDC机房旁通阀异动故障预警工具
        </h2>
        <div className="flex items-center space-x-4">
          {/* 时间模式指示器 */}
          <div className="flex items-center text-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            <span className="text-gray-600">实时模式</span>
          </div>
          {/* 预警铃铛 */}
          <button className="relative p-2 text-gray-600 hover:text-gray-800">
            <span className="text-xl">🔔</span>
            <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              0
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}

// 布局组件
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 p-6 overflow-auto">
          {children}
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
