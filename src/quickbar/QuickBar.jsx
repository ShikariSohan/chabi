import { useEffect, useMemo, useRef, useState } from 'react'
import { formatShortcutForDisplay } from '../utils/shortcutDisplay'

function QuickBar() {
  const [actions, setActions] = useState([])
  const [actionStats, setActionStats] = useState({})
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return actions
      .filter((action) => action.pinned)
      .sort((a, b) => {
        const aStats = actionStats[a.id] || {}
        const bStats = actionStats[b.id] || {}
        const runDiff = (bStats.runCount || 0) - (aStats.runCount || 0)
        if (runDiff !== 0) return runDiff
        return (bStats.lastRunAt || 0) - (aStats.lastRunAt || 0)
      })
      .filter((action) => {
        if (!q) return true
        return [action.name, action.value, action.shortcut].some((value) =>
          (value || '').toLowerCase().includes(q),
        )
      })
  }, [actions, actionStats, query])
  const visibleActions = filtered.slice(0, 6)

  async function refreshActions() {
    const [data, stats] = await Promise.all([
      window.chabi.getActions(),
      window.chabi.getActionStats(),
    ])
    setActions(data)
    setActionStats(stats || {})
  }

  async function runAndHide(action) {
    const result = await window.chabi.runAction(action)
    if (result?.ok) {
      await window.chabi.toggleQuickBar()
      return
    }
    if (!result?.cancelled) {
      await refreshActions()
    }
  }

  useEffect(() => {
    refreshActions()
    requestAnimationFrame(() => inputRef.current?.focus())

    const onFocus = () => {
      refreshActions()
      setQuery('')
      setSelectedIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }

    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  useEffect(() => {
    if (selectedIndex >= visibleActions.length) {
      setSelectedIndex(0)
    }
  }, [selectedIndex, visibleActions.length])

  async function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      await window.chabi.toggleQuickBar()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (visibleActions.length === 0) return
      setSelectedIndex((current) => (current + 1) % visibleActions.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (visibleActions.length === 0) return
      setSelectedIndex((current) => (current - 1 + visibleActions.length) % visibleActions.length)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const action = visibleActions[selectedIndex]
      if (action) {
        await runAndHide(action)
      }
    }
  }

  return (
    <div className="quickBarShell" onKeyDown={onKeyDown}>
      <div className="quickBarPanel">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Run pinned action..."
        />
        <div className="quickBarResults">
          {visibleActions.length === 0 ? (
            <p>No pinned actions</p>
          ) : (
            visibleActions.map((action, index) => (
              <button
                key={action.id}
                className={index === selectedIndex ? 'active' : ''}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => runAndHide(action)}
              >
                <span>{action.name}</span>
                <code>{formatShortcutForDisplay(action.shortcut)}</code>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default QuickBar
