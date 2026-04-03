# Architecture

## Stack
- Electron (main process + tray + windows + shortcuts)
- React + Vite (renderer UIs)

## Important Files
- `electron/main.cjs` - window lifecycle, tray, IPC, shortcut registration, action execution
- `electron/preload.cjs` - secure API bridge via `window.chabi`
- `src/App.jsx` - main app UI and action management
- `src/quickbar/QuickBar.jsx` - floating launcher UI
- `src/styles.css` - main window styling
- `src/quickbar.css` - quick bar styling

## Data Storage (Electron userData)
- `actions.json`
- `settings.json`
- `action-stats.json`
