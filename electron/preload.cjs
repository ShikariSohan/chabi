const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('chabi', {
  getActions: () => ipcRenderer.invoke('actions:get'),
  saveActions: (actions) => ipcRenderer.invoke('actions:save', actions),
  runAction: (action) => ipcRenderer.invoke('actions:run', action),
  toggleApp: () => ipcRenderer.invoke('app:toggle'),
  toggleQuickBar: () => ipcRenderer.invoke('quickbar:toggle'),
  checkShortcut: (accelerator) => ipcRenderer.invoke('shortcut:check', accelerator),
  getCoreShortcuts: () => ipcRenderer.invoke('shortcuts:getCore'),
  getShortcutReport: () => ipcRenderer.invoke('shortcuts:report'),
  getInstalledApps: () => ipcRenderer.invoke('apps:list'),
  getSystemActions: () => ipcRenderer.invoke('system-actions:list'),
  getActionStats: () => ipcRenderer.invoke('action-stats:get'),
  getActionHealth: () => ipcRenderer.invoke('actions:health'),
  exportActions: () => ipcRenderer.invoke('actions:export'),
  importActions: () => ipcRenderer.invoke('actions:import'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setLaunchAtLogin: (value) => ipcRenderer.invoke('settings:setLaunchAtLogin', value),
  setSafeShellMode: (value) => ipcRenderer.invoke('settings:setSafeShellMode', value),
})
