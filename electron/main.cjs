const {
  app,
  BrowserWindow,
  Tray,
  nativeImage,
  ipcMain,
  globalShortcut,
  shell,
  Menu,
  screen,
  dialog,
} = require('electron')
const path = require('path')
const fs = require('fs')
const { exec, execFile } = require('child_process')
const { randomUUID } = require('crypto')

let tray = null
let win = null
let quickBarWin = null

const CHABI_TOGGLE_SHORTCUT = 'CommandOrControl+Shift+K'
const QUICK_BAR_TOGGLE_SHORTCUT = 'CommandOrControl+Shift+L'
const APP_SCAN_DIRS = [
  '/Applications',
  '/System/Applications',
  '/System/Applications/Utilities',
  path.join(app.getPath('home'), 'Applications'),
]
const SYSTEM_ACTIONS = [
  { id: 'sleep', label: 'Sleep Mac' },
  { id: 'lock', label: 'Lock Screen' },
  { id: 'logout', label: 'Log Out' },
  { id: 'restart', label: 'Restart Mac' },
  { id: 'shutdown', label: 'Shut Down Mac' },
  { id: 'screensaver', label: 'Start Screen Saver' },
  { id: 'emptyTrash', label: 'Empty Trash' },
  { id: 'openFinder', label: 'Open Finder' },
  { id: 'openDownloads', label: 'Open Downloads Folder' },
  { id: 'openApplications', label: 'Open Applications Folder' },
  { id: 'openDesktop', label: 'Open Desktop Folder' },
  { id: 'openSystemSettings', label: 'Open System Settings' },
  { id: 'toggleDarkMode', label: 'Toggle Dark Mode' },
]
const RISKY_SYSTEM_ACTION_IDS = new Set(['logout', 'restart', 'shutdown', 'emptyTrash'])
const ACTION_TYPES = new Set(['url', 'app', 'shell', 'system', 'sleep', 'lock', 'logout'])
const VALUE_REQUIRED_TYPES = new Set(['url', 'app', 'shell', 'system'])
const MAX_PINNED_ACTIONS = 8
const NAME_MAX_LENGTH = 60
const SHORTCUT_MAX_LENGTH = 64
const URL_MAX_LENGTH = 512
const APP_PATH_MAX_LENGTH = 512
const SHELL_MAX_LENGTH = 512

const dataDir = app.getPath('userData')
const actionsFile = path.join(dataDir, 'actions.json')
const settingsFile = path.join(dataDir, 'settings.json')
const statsFile = path.join(dataDir, 'action-stats.json')

const defaultActions = [
  {
    id: 'github',
    name: 'GitHub',
    type: 'url',
    value: 'https://github.com',
    shortcut: 'CommandOrControl+Shift+G',
    pinned: true,
  },
  {
    id: 'google',
    name: 'Google',
    type: 'url',
    value: 'https://google.com',
    shortcut: 'CommandOrControl+Shift+O',
    pinned: true,
  },
  {
    id: 'terminal',
    name: 'Terminal',
    type: 'app',
    value: '/System/Applications/Utilities/Terminal.app',
    shortcut: 'CommandOrControl+Shift+T',
    pinned: false,
  },
]

const defaultSettings = {
  launchAtLogin: false,
  safeShellMode: true,
  approvedShellActionIds: [],
}

function focusedWindow() {
  return BrowserWindow.getFocusedWindow() || win || quickBarWin || null
}

function normalizeShortcut(shortcut) {
  return (shortcut || '').trim().toLowerCase()
}

function ensureActionsFile() {
  if (!fs.existsSync(actionsFile)) {
    fs.writeFileSync(actionsFile, JSON.stringify(defaultActions, null, 2), 'utf-8')
  }
}

function ensureSettingsFile() {
  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify(defaultSettings, null, 2), 'utf-8')
  }
}

function ensureStatsFile() {
  if (!fs.existsSync(statsFile)) {
    fs.writeFileSync(statsFile, JSON.stringify({ byAction: {} }, null, 2), 'utf-8')
  }
}

function sanitizeActions(input) {
  if (!Array.isArray(input)) return []

  let pinnedCount = 0

  return input
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const type = ACTION_TYPES.has(item.type) ? item.type : 'url'
      const safeName = String(item.name || '').trim().slice(0, NAME_MAX_LENGTH)
      const needsValue = VALUE_REQUIRED_TYPES.has(type)
      let safeValue = needsValue ? String(item.value || '').trim() : String(item.value || '')
      if (type === 'url') safeValue = safeValue.slice(0, URL_MAX_LENGTH)
      if (type === 'app') safeValue = safeValue.slice(0, APP_PATH_MAX_LENGTH)
      if (type === 'shell') safeValue = safeValue.slice(0, SHELL_MAX_LENGTH)
      if (type === 'system') safeValue = safeValue.slice(0, 80)

      const wantsPinned = !!item.pinned
      const pinned = wantsPinned && pinnedCount < MAX_PINNED_ACTIONS
      if (pinned) pinnedCount += 1

      return {
        id: typeof item.id === 'string' && item.id.trim() ? item.id : randomUUID(),
        name: safeName || 'Untitled action',
        type,
        value: safeValue,
        shortcut: String(item.shortcut || '').trim().slice(0, SHORTCUT_MAX_LENGTH),
        pinned,
      }
    })
}

function readActions() {
  ensureActionsFile()
  return sanitizeActions(JSON.parse(fs.readFileSync(actionsFile, 'utf-8')))
}

function saveActions(actions) {
  fs.writeFileSync(actionsFile, JSON.stringify(sanitizeActions(actions), null, 2), 'utf-8')
}

function readSettings() {
  ensureSettingsFile()
  const parsed = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'))
  return {
    ...defaultSettings,
    ...parsed,
    approvedShellActionIds: Array.isArray(parsed.approvedShellActionIds)
      ? parsed.approvedShellActionIds.filter((id) => typeof id === 'string')
      : [],
  }
}

function saveSettings(settings) {
  const next = {
    ...defaultSettings,
    ...settings,
  }
  fs.writeFileSync(settingsFile, JSON.stringify(next, null, 2), 'utf-8')
}

function readStats() {
  ensureStatsFile()
  const parsed = JSON.parse(fs.readFileSync(statsFile, 'utf-8'))
  return {
    byAction: parsed?.byAction && typeof parsed.byAction === 'object' ? parsed.byAction : {},
  }
}

function saveStats(stats) {
  fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2), 'utf-8')
}

function markActionRun(actionId, ok, errorMessage = '') {
  if (!actionId) return
  const stats = readStats()
  const current = stats.byAction[actionId] || { runCount: 0 }

  stats.byAction[actionId] = {
    ...current,
    runCount: (current.runCount || 0) + (ok ? 1 : 0),
    lastRunAt: Date.now(),
    lastStatus: ok ? 'ok' : 'error',
    lastError: ok ? '' : String(errorMessage || 'Run failed'),
  }

  saveStats(stats)
}

function listInstalledApps() {
  const seen = new Set()
  const apps = []

  for (const dir of APP_SCAN_DIRS) {
    if (!fs.existsSync(dir)) continue

    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.endsWith('.app')) continue
      const appPath = path.join(dir, entry.name)
      if (seen.has(appPath)) continue

      seen.add(appPath)
      apps.push({
        name: entry.name.replace(/\.app$/i, ''),
        path: appPath,
      })
    }
  }

  apps.sort((a, b) => a.name.localeCompare(b.name))
  return apps
}

function confirmDialog({ title, message, detail, buttons = ['Cancel', 'Continue'], cancelId = 0, defaultId = 1 }) {
  const choice = dialog.showMessageBoxSync(focusedWindow(), {
    type: 'warning',
    title,
    message,
    detail,
    buttons,
    cancelId,
    defaultId,
    noLink: true,
  })

  return choice
}

function shouldRunRiskySystemAction(actionId) {
  if (!RISKY_SYSTEM_ACTION_IDS.has(actionId)) return true

  const systemAction = SYSTEM_ACTIONS.find((item) => item.id === actionId)
  const choice = confirmDialog({
    title: 'Confirm System Action',
    message: `Run ${systemAction?.label || actionId}?`,
    detail: 'This action can affect your current session or files.',
  })

  return choice === 1
}

function ensureShellApproved(action) {
  const settings = readSettings()
  if (!settings.safeShellMode) {
    return { ok: true }
  }

  const approvedIds = new Set(settings.approvedShellActionIds)
  if (action.id && approvedIds.has(action.id)) {
    return { ok: true }
  }

  const choice = confirmDialog({
    title: 'Run Shell Command',
    message: action.name || 'Shell action',
    detail: action.value,
    buttons: ['Run Once', 'Always Trust', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
  })

  if (choice === 2) {
    return { ok: false, cancelled: true }
  }

  if (choice === 1 && action.id) {
    approvedIds.add(action.id)
    saveSettings({
      ...settings,
      approvedShellActionIds: [...approvedIds],
    })
  }

  return { ok: true }
}

function runSystemAction(actionId) {
  if (process.platform !== 'darwin') return

  if (actionId === 'sleep') {
    execFile('pmset', ['sleepnow'])
    return
  }

  if (actionId === 'lock') {
    execFile('/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession', ['-suspend'])
    return
  }

  if (actionId === 'logout') {
    execFile('osascript', ['-e', 'tell application "System Events" to log out'])
    return
  }

  if (actionId === 'restart') {
    execFile('osascript', ['-e', 'tell application "System Events" to restart'])
    return
  }

  if (actionId === 'shutdown') {
    execFile('osascript', ['-e', 'tell application "System Events" to shut down'])
    return
  }

  if (actionId === 'screensaver') {
    exec('open -a ScreenSaverEngine')
    return
  }

  if (actionId === 'emptyTrash') {
    execFile('osascript', ['-e', 'tell application "Finder" to empty the trash'])
    return
  }

  if (actionId === 'openFinder') {
    exec('open /System/Library/CoreServices/Finder.app')
    return
  }

  if (actionId === 'openDownloads') {
    exec('open ~/Downloads')
    return
  }

  if (actionId === 'openApplications') {
    exec('open /Applications')
    return
  }

  if (actionId === 'openDesktop') {
    exec('open ~/Desktop')
    return
  }

  if (actionId === 'openSystemSettings') {
    exec('open -a "System Settings"')
    return
  }

  if (actionId === 'toggleDarkMode') {
    execFile('osascript', [
      '-e',
      'tell application "System Events" to tell appearance preferences to set dark mode to not dark mode',
    ])
  }
}

async function runAction(action) {
  if (!action) {
    return { ok: false, error: 'Missing action' }
  }

  try {
    if (action.type === 'url') {
      if (!action.value) return { ok: false, error: 'Missing URL value' }
      await shell.openExternal(action.value)
      markActionRun(action.id, true)
      return { ok: true }
    }

    if (action.type === 'app') {
      if (!action.value) return { ok: false, error: 'Missing app path' }
      const error = await shell.openPath(action.value)
      if (error) {
        markActionRun(action.id, false, error)
        return { ok: false, error }
      }
      markActionRun(action.id, true)
      return { ok: true }
    }

    if (action.type === 'shell') {
      if (!action.value) return { ok: false, error: 'Missing shell command' }

      const approval = ensureShellApproved(action)
      if (!approval.ok) {
        return { ok: false, cancelled: true, error: 'Shell run cancelled' }
      }

      return await new Promise((resolve) => {
        exec(action.value, (error, _stdout, stderr) => {
          if (error) {
            const message = stderr || error.message || 'Shell command failed'
            markActionRun(action.id, false, message)
            resolve({ ok: false, error: message })
            return
          }

          markActionRun(action.id, true)
          resolve({ ok: true })
        })
      })
    }

    const systemActionId = action.type === 'system' ? action.value : action.type
    if (SYSTEM_ACTIONS.some((item) => item.id === systemActionId) || ['sleep', 'lock', 'logout'].includes(systemActionId)) {
      if (!shouldRunRiskySystemAction(systemActionId)) {
        return { ok: false, cancelled: true, error: 'System action cancelled' }
      }
      runSystemAction(systemActionId)
      markActionRun(action.id, true)
      return { ok: true }
    }

    return { ok: false, error: `Unsupported action type: ${action.type}` }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    markActionRun(action.id, false, message)
    return { ok: false, error: message }
  }
}

function getActionsHealth() {
  const actions = readActions()
  const stats = readStats().byAction

  return actions
    .map((action) => {
      const issues = []

      if (!String(action.name || '').trim()) {
        issues.push('Missing action name')
      }

      if (VALUE_REQUIRED_TYPES.has(action.type) && !String(action.value || '').trim()) {
        issues.push('Missing required value')
      }

      if (action.type === 'url' && action.value) {
        try {
          new URL(action.value)
        } catch {
          issues.push('Invalid URL format')
        }
      }

      if (action.type === 'app' && action.value && !fs.existsSync(action.value)) {
        issues.push('App path not found')
      }

      if (action.type === 'shell' && stats[action.id]?.lastStatus === 'error') {
        issues.push(`Last run failed: ${stats[action.id].lastError || 'Unknown error'}`)
      }

      return {
        id: action.id,
        name: action.name,
        type: action.type,
        issues,
      }
    })
    .filter((item) => item.issues.length > 0)
}

function getShortcutDashboard() {
  const actions = readActions()
  const normalizedCore = new Set([normalizeShortcut(CHABI_TOGGLE_SHORTCUT), normalizeShortcut(QUICK_BAR_TOGGLE_SHORTCUT)])
  const ownNormalized = new Set(
    actions
      .map((action) => normalizeShortcut(action.shortcut))
      .filter(Boolean),
  )

  const counts = new Map()
  for (const action of actions) {
    const key = normalizeShortcut(action.shortcut)
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  return actions
    .filter((action) => action.shortcut)
    .map((action) => {
      const key = normalizeShortcut(action.shortcut)

      if (counts.get(key) > 1) {
        return {
          id: action.id,
          name: action.name,
          shortcut: action.shortcut,
          level: 'error',
          issue: 'Duplicate shortcut',
        }
      }

      if (normalizedCore.has(key)) {
        return {
          id: action.id,
          name: action.name,
          shortcut: action.shortcut,
          level: 'error',
          issue: 'Conflicts with core app shortcut',
        }
      }

      try {
        if (globalShortcut.isRegistered(action.shortcut) && !ownNormalized.has(key)) {
          return {
            id: action.id,
            name: action.name,
            shortcut: action.shortcut,
            level: 'error',
            issue: 'Shortcut is already reserved by another app/system',
          }
        }

        if (globalShortcut.isRegistered(action.shortcut) && ownNormalized.has(key)) {
          return {
            id: action.id,
            name: action.name,
            shortcut: action.shortcut,
            level: 'ok',
            issue: 'OK',
          }
        }

        const ok = globalShortcut.register(action.shortcut, () => {})
        if (!ok) {
          return {
            id: action.id,
            name: action.name,
            shortcut: action.shortcut,
            level: 'error',
            issue: 'Shortcut unavailable (reserved)',
          }
        }

        globalShortcut.unregister(action.shortcut)
      } catch {
        return {
          id: action.id,
          name: action.name,
          shortcut: action.shortcut,
          level: 'error',
          issue: 'Invalid shortcut format',
        }
      }

      return {
        id: action.id,
        name: action.name,
        shortcut: action.shortcut,
        level: 'ok',
        issue: 'OK',
      }
    })
}

function registerActionShortcuts(actions) {
  for (const action of actions) {
    if (!action.shortcut) continue

    try {
      const ok = globalShortcut.register(action.shortcut, () => {
        runAction(action)
      })

      if (!ok) {
        console.warn(`Could not register shortcut: ${action.shortcut}`)
      }
    } catch (error) {
      console.warn(`Invalid shortcut for ${action.name}: ${action.shortcut}`, error.message)
    }
  }
}

function registerCoreShortcuts() {
  const chabiOk = globalShortcut.register(CHABI_TOGGLE_SHORTCUT, () => {
    toggleWindow()
  })
  if (!chabiOk) {
    console.warn(`Could not register Chabi toggle shortcut: ${CHABI_TOGGLE_SHORTCUT}`)
  }

  const quickBarOk = globalShortcut.register(QUICK_BAR_TOGGLE_SHORTCUT, () => {
    toggleQuickBar()
  })
  if (!quickBarOk) {
    console.warn(`Could not register quick bar toggle shortcut: ${QUICK_BAR_TOGGLE_SHORTCUT}`)
  }
}

function registerAllShortcuts() {
  globalShortcut.unregisterAll()
  registerCoreShortcuts()
  registerActionShortcuts(readActions())
}

function checkShortcutAvailability(accelerator) {
  if (!accelerator || !accelerator.trim()) {
    return {
      valid: false,
      available: false,
      reason: 'empty',
    }
  }

  const candidate = accelerator.trim()

  try {
    if (globalShortcut.isRegistered(candidate)) {
      return {
        valid: true,
        available: false,
        reason: 'already-registered',
      }
    }

    const ok = globalShortcut.register(candidate, () => {})
    if (!ok) {
      return {
        valid: true,
        available: false,
        reason: 'unavailable',
      }
    }

    globalShortcut.unregister(candidate)

    return {
      valid: true,
      available: true,
      reason: null,
    }
  } catch {
    return {
      valid: false,
      available: false,
      reason: 'invalid',
    }
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 560,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    vibrancy: 'under-window',
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.platform === 'darwin') {
    win.setWindowButtonVisibility(false)
  }

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  win.on('blur', () => {
    if (!win.webContents.isDevToolsOpened()) {
      win.hide()
    }
  })
}

function createQuickBarWindow() {
  quickBarWin = new BrowserWindow({
    width: 700,
    height: 320,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    vibrancy: 'under-window',
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.platform === 'darwin') {
    quickBarWin.setWindowButtonVisibility(false)
  }

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    quickBarWin.loadURL(`${devUrl}/quickbar.html`)
  } else {
    quickBarWin.loadFile(path.join(__dirname, '..', 'dist', 'quickbar.html'))
  }

  quickBarWin.on('blur', () => {
    if (!quickBarWin.webContents.isDevToolsOpened()) {
      quickBarWin.hide()
    }
  })
}

function createTray() {
  const image = nativeImage.createFromPath(path.join(__dirname, 'assets', 'trayTemplate.png'))
  image.setTemplateImage(true)
  tray = new Tray(image)
  tray.setToolTip('Chabi')

  tray.on('click', toggleWindow)
  tray.on('right-click', () => {
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open Chabi', click: toggleWindow },
      { label: 'Open Quick Bar', click: toggleQuickBar },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ])
    tray.popUpContextMenu(contextMenu)
  })
}

function toggleWindow() {
  if (!win || !tray) return

  if (win.isVisible()) {
    win.hide()
    return
  }

  const trayBounds = tray.getBounds()
  const windowBounds = win.getBounds()
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2)
  const y = Math.round(trayBounds.y + trayBounds.height + 8)

  win.setPosition(x, y, false)
  win.show()
  win.focus()
}

function toggleQuickBar() {
  if (!quickBarWin) return

  if (quickBarWin.isVisible()) {
    quickBarWin.hide()
    return
  }

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { width: screenWidth, y: screenY } = display.workArea
  const windowBounds = quickBarWin.getBounds()
  const x = Math.round(display.workArea.x + screenWidth / 2 - windowBounds.width / 2)
  const y = Math.round(screenY + 42)

  quickBarWin.setPosition(x, y, false)
  quickBarWin.show()
  quickBarWin.focus()
}

ipcMain.handle('actions:get', () => readActions())
ipcMain.handle('actions:save', (_event, actions) => {
  saveActions(actions)
  registerAllShortcuts()
  return readActions()
})
ipcMain.handle('actions:run', async (_event, action) => {
  return await runAction(action)
})
ipcMain.handle('actions:export', async () => {
  const result = await dialog.showSaveDialog(focusedWindow(), {
    title: 'Export Chabi Actions',
    defaultPath: 'chabi-actions.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })

  if (result.canceled || !result.filePath) {
    return { ok: false, cancelled: true }
  }

  fs.writeFileSync(result.filePath, JSON.stringify(readActions(), null, 2), 'utf-8')
  return { ok: true, path: result.filePath }
})
ipcMain.handle('actions:import', async () => {
  const result = await dialog.showOpenDialog(focusedWindow(), {
    title: 'Import Chabi Actions',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })

  if (result.canceled || !result.filePaths[0]) {
    return { ok: false, cancelled: true }
  }

  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8')
    const parsed = JSON.parse(raw)
    const sanitized = sanitizeActions(parsed)

    saveActions(sanitized)
    registerAllShortcuts()

    return { ok: true, actions: readActions() }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
})
ipcMain.handle('actions:health', () => {
  return getActionsHealth()
})
ipcMain.handle('app:toggle', () => {
  toggleWindow()
  return true
})
ipcMain.handle('quickbar:toggle', () => {
  toggleQuickBar()
  return true
})
ipcMain.handle('shortcut:check', (_event, accelerator) => {
  return checkShortcutAvailability(accelerator)
})
ipcMain.handle('shortcuts:getCore', () => {
  return {
    appToggle: CHABI_TOGGLE_SHORTCUT,
    quickBarToggle: QUICK_BAR_TOGGLE_SHORTCUT,
  }
})
ipcMain.handle('shortcuts:report', () => {
  return getShortcutDashboard()
})
ipcMain.handle('apps:list', () => {
  return listInstalledApps()
})
ipcMain.handle('system-actions:list', () => {
  return SYSTEM_ACTIONS
})
ipcMain.handle('action-stats:get', () => {
  return readStats().byAction
})
ipcMain.handle('settings:get', () => {
  const settings = readSettings()
  return {
    ...settings,
    launchAtLogin: app.getLoginItemSettings().openAtLogin,
  }
})
ipcMain.handle('settings:setLaunchAtLogin', (_event, value) => {
  app.setLoginItemSettings({ openAtLogin: !!value })

  const settings = readSettings()
  saveSettings({ ...settings, launchAtLogin: !!value })

  return {
    ok: true,
    launchAtLogin: app.getLoginItemSettings().openAtLogin,
  }
})
ipcMain.handle('settings:setSafeShellMode', (_event, value) => {
  const settings = readSettings()
  saveSettings({ ...settings, safeShellMode: !!value })
  return { ok: true, safeShellMode: !!value }
})

app.whenReady().then(() => {
  ensureActionsFile()
  ensureSettingsFile()
  ensureStatsFile()

  const settings = readSettings()
  app.setLoginItemSettings({ openAtLogin: !!settings.launchAtLogin })

  createWindow()
  createQuickBarWindow()
  createTray()
  registerAllShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      createQuickBarWindow()
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', (event) => {
  event.preventDefault()
})
