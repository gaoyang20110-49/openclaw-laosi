import { create } from 'zustand'

interface SettingsState {
  // 时间模式
  timeMode: 'realtime' | 'debug'
  debugTime: string | null
  
  // 操作
  setTimeMode: (mode: 'realtime' | 'debug', debugTime?: string) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  timeMode: 'realtime',
  debugTime: null,
  
  setTimeMode: (mode, debugTime) => set({
    timeMode: mode,
    debugTime: debugTime || null
  })
}))
