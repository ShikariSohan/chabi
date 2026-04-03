const TOKEN_MAP = {
  command: '⌘',
  cmd: '⌘',
  control: '⌃',
  ctrl: '⌃',
  option: '⌥',
  alt: '⌥',
  shift: '⇧',
  enter: '↩',
  return: '↩',
  esc: '⎋',
  escape: '⎋',
  tab: '⇥',
  space: '␣',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  backspace: '⌫',
  delete: '⌦',
}

function formatToken(token) {
  const lower = token.toLowerCase()

  if (lower === 'commandorcontrol') {
    return navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'
  }

  return TOKEN_MAP[lower] || token
}

export function formatShortcutForDisplay(shortcut) {
  if (!shortcut) return 'No shortcut'
  return shortcut
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)
    .map(formatToken)
    .join(' ')
}
