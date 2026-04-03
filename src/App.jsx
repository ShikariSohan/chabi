import { useEffect, useMemo, useRef, useState } from 'react'
import { formatShortcutForDisplay } from './utils/shortcutDisplay'

const emptyForm = {
  id: '',
  name: '',
  type: 'url',
  value: '',
  shortcut: '',
  pinned: true,
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta'])
const VALUE_REQUIRED_TYPES = new Set(['url', 'app', 'shell', 'system'])
const MAX_PINNED_ACTIONS = 8
const ACTIONS_PER_PAGE = 8
const NAME_MAX_LENGTH = 60
const URL_MAX_LENGTH = 512
const APP_PATH_MAX_LENGTH = 512
const SHELL_MAX_LENGTH = 512
const SYSTEM_ACTION_MAX_LENGTH = 80
const SHORTCUT_MAX_LENGTH = 64

const KEY_MAP = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Esc',
  Enter: 'Enter',
  Tab: 'Tab',
  Space: 'Space',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
}

const bashExamples = [
  'open -na "Visual Studio Code"',
  'open -a "Brave Browser" https://github.com',
  'say "Shortcut triggered"',
]

const bashPresets = [
  { label: 'Open VS Code', command: 'open -na "Visual Studio Code"' },
  { label: 'Open GitHub in Brave', command: 'open -a "Brave Browser" https://github.com' },
  { label: 'Open Terminal', command: 'open -a "Terminal"' },
  {
    label: 'Show Date Notification',
    command: 'osascript -e \'display notification (do shell script "date") with title "Chabi"\'',
  },
  { label: 'Say Done', command: 'say "Task complete"' },
]
const LEGACY_SYSTEM_LABELS = {
  sleep: 'Sleep Mac',
  lock: 'Lock Screen',
  logout: 'Log Out',
}

function normalizeShortcut(value) {
  return (value || '').trim().toLowerCase()
}

function getAppNameFromPath(appPath) {
  const segment = (appPath || '').split('/').pop() || ''
  return segment.replace(/\.app$/i, '')
}

function keyEventToAccelerator(event) {
  if (MODIFIER_KEYS.has(event.key)) {
    return null
  }

  const parts = []

  if (event.metaKey) {
    parts.push('Command')
  }
  if (event.ctrlKey) {
    parts.push('Control')
  }
  if (event.altKey) {
    parts.push('Alt')
  }
  if (event.shiftKey) {
    parts.push('Shift')
  }

  let key = KEY_MAP[event.key] || event.key

  if (/^F\d{1,2}$/i.test(key)) {
    key = key.toUpperCase()
  } else if (key.length === 1) {
    key = key.toUpperCase()
  }

  if (!key || MODIFIER_KEYS.has(key)) {
    return null
  }

  parts.push(key)
  return parts.join('+')
}

function App() {
  const shortcutInputRef = useRef(null)

  const [actions, setActions] = useState([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recordingShortcut, setRecordingShortcut] = useState(false)
  const [shortcutStatus, setShortcutStatus] = useState({ kind: 'idle', message: '' })
  const [showBindingsGuide, setShowBindingsGuide] = useState(false)
  const [coreShortcuts, setCoreShortcuts] = useState({
    appToggle: 'CommandOrControl+Shift+K',
    quickBarToggle: 'CommandOrControl+Shift+L',
  })
  const [installedApps, setInstalledApps] = useState([])
  const [systemActions, setSystemActions] = useState([])
  const [shortcutReport, setShortcutReport] = useState([])
  const [healthReport, setHealthReport] = useState([])
  const [settings, setSettings] = useState({ launchAtLogin: false, safeShellMode: true })
  const [formErrors, setFormErrors] = useState({})
  const [banner, setBanner] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  async function refreshDiagnostics() {
    const [report, health] = await Promise.all([
      window.chabi.getShortcutReport(),
      window.chabi.getActionHealth(),
    ])
    setShortcutReport(report)
    setHealthReport(health)
  }

  useEffect(() => {
    Promise.all([
      window.chabi.getActions(),
      window.chabi.getCoreShortcuts(),
      window.chabi.getInstalledApps(),
      window.chabi.getSystemActions(),
      window.chabi.getShortcutReport(),
      window.chabi.getActionHealth(),
      window.chabi.getSettings(),
    ]).then(([data, shortcuts, apps, availableSystemActions, report, health, currentSettings]) => {
      setActions(data)
      setCoreShortcuts(shortcuts)
      setInstalledApps(apps)
      setSystemActions(availableSystemActions)
      setShortcutReport(report)
      setHealthReport(health)
      setSettings(currentSettings)
      setLoading(false)
    })
  }, [])

  const systemActionMap = useMemo(() => {
    return Object.fromEntries(systemActions.map((item) => [item.id, item.label]))
  }, [systemActions])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return actions

    return actions.filter((action) => {
      const appName = action.type === 'app' ? getAppNameFromPath(action.value) : ''
      const systemLabel =
        action.type === 'system'
          ? systemActionMap[action.value] || ''
          : LEGACY_SYSTEM_LABELS[action.type] || ''
      return [action.name, action.value, appName, systemLabel, action.shortcut].some((value) =>
        (value || '').toLowerCase().includes(q),
      )
    })
  }, [actions, query, systemActionMap])

  const appOptions = useMemo(() => {
    const options = [...installedApps]
    if (form.type === 'app' && form.value && !options.some((app) => app.path === form.value)) {
      options.unshift({
        name: `${getAppNameFromPath(form.value)} (Custom)`,
        path: form.value,
      })
    }
    return options
  }, [form.type, form.value, installedApps])

  const systemActionOptions = useMemo(() => {
    const options = [...systemActions]
    if (form.type === 'system' && form.value && !options.some((item) => item.id === form.value)) {
      options.unshift({ id: form.value, label: form.value })
    }
    return options
  }, [form.type, form.value, systemActions])

  const pinned = filtered.filter((action) => action.pinned)
  const others = filtered.filter((action) => !action.pinned)
  const orderedActions = useMemo(() => [...pinned, ...others], [pinned, others])
  const totalPinnedCount = actions.filter((action) => action.pinned).length
  const totalPages = Math.max(1, Math.ceil(orderedActions.length / ACTIONS_PER_PAGE))
  const pagedActions = orderedActions.slice(
    (currentPage - 1) * ACTIONS_PER_PAGE,
    currentPage * ACTIONS_PER_PAGE,
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [query])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  function getActionValueLabel(action) {
    if (action.type === 'app') {
      return getAppNameFromPath(action.value)
    }
    if (action.type === 'system') {
      return systemActionMap[action.value] || action.value || 'System action'
    }
    if (LEGACY_SYSTEM_LABELS[action.type]) {
      return LEGACY_SYSTEM_LABELS[action.type]
    }
    return action.value
  }

  async function persist(nextActions) {
    const saved = await window.chabi.saveActions(nextActions)
    setActions(saved)
    await refreshDiagnostics()
  }

  async function runAndNotify(action) {
    const result = await window.chabi.runAction(action)
    if (!result?.ok && !result?.cancelled) {
      setBanner(result?.error || 'Action failed')
      await refreshDiagnostics()
      return
    }
    setBanner('')
    await refreshDiagnostics()
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
    setRecordingShortcut(false)
    setShortcutStatus({ kind: 'idle', message: '' })
    setFormErrors({})
  }

  function getValueMaxLength(type) {
    if (type === 'url') return URL_MAX_LENGTH
    if (type === 'app') return APP_PATH_MAX_LENGTH
    if (type === 'shell') return SHELL_MAX_LENGTH
    if (type === 'system') return SYSTEM_ACTION_MAX_LENGTH
    return URL_MAX_LENGTH
  }

  function canPinAction(nextPinned, actionId = editingId) {
    if (!nextPinned) return true
    const existing = actionId ? actions.find((item) => item.id === actionId) : null
    if (existing?.pinned) return true
    return totalPinnedCount < MAX_PINNED_ACTIONS
  }

  function getShortcutDuplicate(accelerator) {
    const normalized = normalizeShortcut(accelerator)
    return actions.find((action) => {
      if (action.id === editingId) return false
      return normalizeShortcut(action.shortcut) === normalized
    })
  }

  function isEditingSameShortcut(accelerator) {
    if (!editingId) return false
    const action = actions.find((item) => item.id === editingId)
    return normalizeShortcut(action?.shortcut) === normalizeShortcut(accelerator)
  }

  async function validateShortcut(accelerator) {
    if (!accelerator) {
      setShortcutStatus({ kind: 'idle', message: '' })
      return true
    }

    const duplicate = getShortcutDuplicate(accelerator)
    if (duplicate) {
      setShortcutStatus({
        kind: 'error',
        message: `Already used by "${duplicate.name}".`,
      })
      return false
    }

    if (isEditingSameShortcut(accelerator)) {
      setShortcutStatus({ kind: 'ok', message: 'Shortcut unchanged.' })
      return true
    }

    const result = await window.chabi.checkShortcut(accelerator)
    if (!result.valid) {
      setShortcutStatus({ kind: 'error', message: 'Invalid shortcut format.' })
      return false
    }

    if (!result.available) {
      setShortcutStatus({ kind: 'error', message: 'Shortcut is unavailable on this system.' })
      return false
    }

    setShortcutStatus({ kind: 'ok', message: 'Shortcut is available.' })
    return true
  }

  function validateForm() {
    const errors = {}
    const trimmedName = form.name.trim()
    const trimmedValue = form.value.trim()

    if (!trimmedName) {
      errors.name = 'Name is required.'
    } else if (trimmedName.length > NAME_MAX_LENGTH) {
      errors.name = `Name must be ${NAME_MAX_LENGTH} characters or less.`
    }

    if (VALUE_REQUIRED_TYPES.has(form.type) && !trimmedValue) {
      errors.value = 'This value is required for the selected type.'
    } else if (trimmedValue.length > getValueMaxLength(form.type)) {
      errors.value = `Value is too long for ${form.type}.`
    }

    if (form.shortcut.trim().length > SHORTCUT_MAX_LENGTH) {
      errors.shortcut = `Shortcut must be ${SHORTCUT_MAX_LENGTH} characters or less.`
    }

    if (!canPinAction(form.pinned)) {
      errors.pinned = `You can pin up to ${MAX_PINNED_ACTIONS} actions.`
    }

    return errors
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const errors = validateForm()
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) {
      return
    }

    const shortcut = form.shortcut.trim()
    const shortcutValid = await validateShortcut(shortcut)
    if (!shortcutValid) return

    const payload = {
      ...form,
      name: form.name.trim().slice(0, NAME_MAX_LENGTH),
      value: form.value.trim().slice(0, getValueMaxLength(form.type)),
      shortcut: shortcut.slice(0, SHORTCUT_MAX_LENGTH),
      id: editingId || crypto.randomUUID(),
    }

    const nextActions = editingId
      ? actions.map((action) => (action.id === editingId ? payload : action))
      : [payload, ...actions]

    await persist(nextActions)
    resetForm()
  }

  function handleEdit(action) {
    setEditingId(action.id)
    if (LEGACY_SYSTEM_LABELS[action.type]) {
      setForm({ ...action, type: 'system', value: action.type })
    } else {
      setForm(action)
    }
    setShortcutStatus({ kind: 'idle', message: '' })
    setRecordingShortcut(false)
    setFormErrors({})
  }

  async function handleDelete(id) {
    await persist(actions.filter((action) => action.id !== id))
    if (editingId === id) resetForm()
  }

  async function togglePinned(id) {
    const current = actions.find((action) => action.id === id)
    if (!current) return

    if (!current.pinned && totalPinnedCount >= MAX_PINNED_ACTIONS) {
      setBanner(`Pinned actions limit reached (${MAX_PINNED_ACTIONS} max).`)
      return
    }

    const nextActions = actions.map((action) =>
      action.id === id ? { ...action, pinned: !action.pinned } : action,
    )
    await persist(nextActions)
  }

  async function handleShortcutKeyDown(event) {
    if (!recordingShortcut) {
      return
    }

    event.preventDefault()

    if (event.key === 'Escape') {
      setRecordingShortcut(false)
      setShortcutStatus({ kind: 'idle', message: '' })
      return
    }

    const accelerator = keyEventToAccelerator(event)
    if (!accelerator) {
      return
    }

    setForm({ ...form, shortcut: accelerator })
    setRecordingShortcut(false)
    await validateShortcut(accelerator)
  }

  async function handleImportActions() {
    const result = await window.chabi.importActions()
    if (!result?.ok) {
      if (!result?.cancelled) {
        setBanner(result?.error || 'Import failed')
      }
      return
    }

    setActions(result.actions || [])
    await refreshDiagnostics()
    setBanner('Imported actions successfully.')
  }

  async function handleExportActions() {
    const result = await window.chabi.exportActions()
    if (!result?.ok) {
      if (!result?.cancelled) {
        setBanner(result?.error || 'Export failed')
      }
      return
    }

    setBanner(`Exported to ${result.path}`)
  }

  async function handleLaunchAtLoginToggle(nextValue) {
    const result = await window.chabi.setLaunchAtLogin(nextValue)
    if (result?.ok) {
      setSettings({ ...settings, launchAtLogin: result.launchAtLogin })
    }
  }

  async function handleSafeShellToggle(nextValue) {
    const result = await window.chabi.setSafeShellMode(nextValue)
    if (result?.ok) {
      setSettings({ ...settings, safeShellMode: result.safeShellMode })
    }
  }

  const shortcutIssues = shortcutReport.filter((item) => item.level === 'error')

  function renderValueField() {
    if (form.type === 'app') {
      return (
        <label>
          App
          <select
            value={form.value}
            onChange={(event) => {
              setForm({ ...form, value: event.target.value })
              setFormErrors({ ...formErrors, value: '' })
            }}
          >
            <option value="">Choose an installed app</option>
            {appOptions.map((appItem) => (
              <option key={appItem.path} value={appItem.path}>
                {appItem.name}
              </option>
            ))}
          </select>
          <span className="fieldHint">Pulled from Applications folders on this Mac.</span>
        </label>
      )
    }

    if (form.type === 'shell') {
      return (
        <label>
          Bash command
          <input
            value={form.value}
            onChange={(event) => {
              setForm({ ...form, value: event.target.value.slice(0, SHELL_MAX_LENGTH) })
              setFormErrors({ ...formErrors, value: '' })
            }}
            placeholder='open -a "Brave Browser" https://github.com'
            maxLength={SHELL_MAX_LENGTH}
          />
          <div className="exampleBlock">
            <p>Examples:</p>
            {bashExamples.map((example) => (
              <code key={example}>{example}</code>
            ))}
          </div>
          <div className="presetGrid">
            {bashPresets.map((preset) => (
              <button
                key={preset.label}
                className="presetButton"
                type="button"
                onClick={() => {
                  setForm({ ...form, value: preset.command.slice(0, SHELL_MAX_LENGTH) })
                  setFormErrors({ ...formErrors, value: '' })
                }}
              >
                + {preset.label}
              </button>
            ))}
          </div>
        </label>
      )
    }

    if (form.type === 'system') {
      return (
        <label>
          System action
          <select
            value={form.value}
            onChange={(event) => {
              setForm({ ...form, value: event.target.value })
              setFormErrors({ ...formErrors, value: '' })
            }}
          >
            <option value="">Select an action</option>
            {systemActionOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <span className="fieldHint">Risky actions may ask for confirmation before running.</span>
        </label>
      )
    }

    return (
      <label>
        URL
        <input
          value={form.value}
          onChange={(event) => {
            setForm({ ...form, value: event.target.value.slice(0, URL_MAX_LENGTH) })
            setFormErrors({ ...formErrors, value: '' })
          }}
          placeholder="https://github.com"
          maxLength={URL_MAX_LENGTH}
        />
      </label>
    )
  }

  return (
    <div className="shell">
      <div className="ambientGlow ambientGlowOne" />
      <div className="ambientGlow ambientGlowTwo" />

      <div className="panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Chabi</p>
            <h1>Command hub</h1>
          </div>
          <div className="topbarActions">
            <button className="ghostButton" onClick={() => window.chabi.toggleQuickBar()}>
              Quick bar
            </button>
            <button className="ghostButton" onClick={handleImportActions}>
              Import
            </button>
            <button className="ghostButton" onClick={handleExportActions}>
              Export
            </button>
            <button className="ghostButton" onClick={() => window.chabi.toggleApp()}>
              Hide
            </button>
          </div>
        </header>

        {banner && <section className="statusBanner">{banner}</section>}

        <section className="searchSection">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search actions..."
          />
          <span className="hint">
            {formatShortcutForDisplay(coreShortcuts.appToggle)} opens Chabi,{' '}
            {formatShortcutForDisplay(coreShortcuts.quickBarToggle)} opens Quick Bar
          </span>
        </section>

        <div className="layoutGrid">
          <div className="layoutCol layoutColPrimary">
            <section className="card settingsCard">
              <div className="sectionTitle">
                <h2>Preferences</h2>
              </div>
              <label className="checkboxRow">
                <input
                  type="checkbox"
                  checked={!!settings.launchAtLogin}
                  onChange={(event) => handleLaunchAtLoginToggle(event.target.checked)}
                />
                Launch at login
              </label>
              <label className="checkboxRow">
                <input
                  type="checkbox"
                  checked={!!settings.safeShellMode}
                  onChange={(event) => handleSafeShellToggle(event.target.checked)}
                />
                Safe shell mode (confirm first run)
              </label>
            </section>

            <section className="card quickCard">
              <div className="sectionTitle">
                <h2>Pinned</h2>
                <span>{pinned.length}</span>
              </div>
              <div className="pillRow">
                {pinned.length === 0 && <p className="muted">No pinned actions yet.</p>}
                {pinned.map((action) => (
                  <button
                    key={action.id}
                    className="pill"
                    onClick={() => runAndNotify(action)}
                    title={action.value}
                  >
                    {action.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="card formCard">
              <div className="sectionTitle">
                <h2>{editingId ? 'Edit action' : 'Add action'}</h2>
                {editingId && (
                  <button className="linkButton" onClick={resetForm}>
                    Cancel
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="actionForm">
                <label>
                  Name
                  <input
                    value={form.name}
                    onChange={(event) => {
                      setForm({ ...form, name: event.target.value.slice(0, NAME_MAX_LENGTH) })
                      setFormErrors({ ...formErrors, name: '' })
                    }}
                    placeholder="GitHub"
                    maxLength={NAME_MAX_LENGTH}
                  />
                  {formErrors.name && <span className="fieldError">{formErrors.name}</span>}
                </label>

                <label>
                  Type
                  <select
                    value={form.type}
                    onChange={(event) => {
                      const nextType = event.target.value
                      const nextValue =
                        nextType === 'system' ? systemActions[0]?.id || '' : nextType === 'app' ? '' : ''
                      setForm({ ...form, type: nextType, value: nextValue })
                      setFormErrors({ ...formErrors, value: '' })
                    }}
                  >
                    <option value="url">URL</option>
                    <option value="app">Installed app</option>
                    <option value="shell">Bash command</option>
                    <option value="system">System action</option>
                  </select>
                </label>

                {renderValueField()}
                {formErrors.value && <span className="fieldError">{formErrors.value}</span>}

                <label>
                  <div className="labelRow">
                    <span>Shortcut</span>
                    <button
                      className="iconButton"
                      type="button"
                      onClick={() => setShowBindingsGuide((value) => !value)}
                      title="Show shortcut bindings help"
                    >
                      {showBindingsGuide ? '-' : '+'}
                    </button>
                  </div>
                  <div className="shortcutRow">
                    <input
                      ref={shortcutInputRef}
                      value={form.shortcut}
                      onKeyDown={handleShortcutKeyDown}
                      onBlur={() => setRecordingShortcut(false)}
                      onChange={() => {}}
                      placeholder="Press Record then keys"
                      readOnly
                    />
                    <button
                      className="smallButton"
                      type="button"
                      onClick={() => {
                        setRecordingShortcut(true)
                        setShortcutStatus({ kind: 'hint', message: 'Press a key combo. Esc to cancel.' })
                        requestAnimationFrame(() => shortcutInputRef.current?.focus())
                      }}
                    >
                      {recordingShortcut ? 'Recording...' : 'Record'}
                    </button>
                    <button
                      className="smallButton"
                      type="button"
                      onClick={() => {
                        setForm({ ...form, shortcut: '' })
                        setShortcutStatus({ kind: 'idle', message: '' })
                        setRecordingShortcut(false)
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  {showBindingsGuide && (
                    <div className="bindingsGuide">
                      <p>Bindings guide</p>
                      <code>CommandOrControl = {formatShortcutForDisplay('CommandOrControl')}</code>
                      <code>Shift = {formatShortcutForDisplay('Shift')}</code>
                      <code>Alt/Option = {formatShortcutForDisplay('Alt')}</code>
                      <code>Control = {formatShortcutForDisplay('Control')}</code>
                      <code>Example: {formatShortcutForDisplay('CommandOrControl+Shift+K')}</code>
                    </div>
                  )}
                </label>

                {shortcutStatus.kind !== 'idle' && (
                  <p className={`shortcutStatus ${shortcutStatus.kind}`}>{shortcutStatus.message}</p>
                )}
                {formErrors.shortcut && <span className="fieldError">{formErrors.shortcut}</span>}

                <label className="checkboxRow">
                  <input
                    type="checkbox"
                    checked={form.pinned}
                    onChange={(event) => {
                      const nextPinned = event.target.checked
                      if (!canPinAction(nextPinned)) {
                        setFormErrors({
                          ...formErrors,
                          pinned: `You can pin up to ${MAX_PINNED_ACTIONS} actions.`,
                        })
                        return
                      }
                      setForm({ ...form, pinned: nextPinned })
                      setFormErrors({ ...formErrors, pinned: '' })
                    }}
                  />
                  Pin to quick bar ({totalPinnedCount}/{MAX_PINNED_ACTIONS})
                </label>
                {formErrors.pinned && <span className="fieldError">{formErrors.pinned}</span>}

                <button className="primaryButton" type="submit">
                  {editingId ? 'Save changes' : 'Add action'}
                </button>
              </form>
            </section>
          </div>

          <div className="layoutCol layoutColSecondary">
            <section className="card listCard">
              <div className="sectionTitle">
                <h2>All actions</h2>
                <span>
                  {orderedActions.length} / page {currentPage}
                </span>
              </div>

              {loading ? (
                <p className="muted">Loading...</p>
              ) : orderedActions.length === 0 ? (
                <p className="muted">Nothing matched that search.</p>
              ) : (
                <>
                  <div className="actionList">
                    {pagedActions.map((action) => (
                    <article className="actionItem" key={action.id}>
                      <div className="actionMeta">
                        <div className="nameRow">
                          <strong>{action.name}</strong>
                          {action.pinned && <span className="tag">Pinned</span>}
                        </div>
                        <p>{getActionValueLabel(action)}</p>
                        {action.type === 'app' && <span className="fieldHint">{action.value}</span>}
                        <code>{formatShortcutForDisplay(action.shortcut)}</code>
                      </div>
                      <div className="actionButtons">
                        <button className="smallButton" onClick={() => runAndNotify(action)}>
                          Run
                        </button>
                        <button className="smallButton" onClick={() => handleEdit(action)}>
                          Edit
                        </button>
                        <button className="smallButton" onClick={() => togglePinned(action.id)}>
                          {action.pinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button className="smallButton danger" onClick={() => handleDelete(action.id)}>
                          Delete
                        </button>
                      </div>
                    </article>
                    ))}
                  </div>
                  <div className="paginationRow">
                    <button
                      className="smallButton"
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                    >
                      Prev
                    </button>
                    <p className="muted">
                      Page {currentPage} of {totalPages}
                    </p>
                    <button
                      className="smallButton"
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>

          <div className="layoutCol layoutColDiagnostics">
            <section className="card diagnosticsCard">
              <div className="sectionTitle">
                <h2>Shortcut Conflicts</h2>
                <span>{shortcutIssues.length}</span>
              </div>
              {shortcutIssues.length === 0 ? (
                <p className="muted">No shortcut conflicts detected.</p>
              ) : (
                <div className="diagnosticList">
                  {shortcutIssues.map((issue) => (
                    <article key={issue.id} className="diagnosticItem">
                      <strong>{issue.name}</strong>
                      <code>{formatShortcutForDisplay(issue.shortcut)}</code>
                      <p>{issue.issue}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="card diagnosticsCard">
              <div className="sectionTitle">
                <h2>Action Health</h2>
                <span>{healthReport.length}</span>
              </div>
              {healthReport.length === 0 ? (
                <p className="muted">No health issues detected.</p>
              ) : (
                <div className="diagnosticList">
                  {healthReport.map((item) => (
                    <article key={item.id} className="diagnosticItem">
                      <strong>{item.name}</strong>
                      {item.issues.map((issue) => (
                        <p key={issue}>{issue}</p>
                      ))}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
