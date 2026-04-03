# Chabi

Chabi is a glassy macOS menu bar launcher built with Electron + React + Vite.
It lets you create actions (URL, app, shell, system), bind global shortcuts, and run them from either the main panel or a floating Quick Bar.

> Note: Vibe coded with care.

## Why Sohan Needed It
Sohan wanted a fast command launcher that feels native to macOS, stays out of the way in the menu bar, and removes repetitive context-switching during work.

Instead of opening apps, tabs, and scripts manually all day, Chabi gives one place to:
- trigger daily tools with one shortcut
- run quick shell automations safely
- keep the most-used actions in a floating quick bar

This project started as a personal productivity tool and is now ready to share publicly.

## Features
- Menu bar app with frameless transparent UI
- Floating Quick Bar with keyboard navigation (`Up/Down/Enter/Esc`)
- Action types:
  - URL
  - Installed App
  - Bash/Shell Command
  - System Actions (sleep, lock, logout, restart, shutdown, etc.)
- Global shortcut recording + validation
- Shortcut conflict diagnostics
- Action health diagnostics
- Import/Export actions as JSON
- Safe shell mode (confirm first run / trust action)
- Risky action confirmation for destructive system actions
- Launch at login toggle
- Usage-based ranking in Quick Bar (recent/frequent first)

## Current Limits and Validation
- Maximum pinned actions: `8`
- “All actions” list is paginated: `8` items per page
- Input limits:
  - Name: `60` chars
  - Shortcut: `64` chars
  - URL value: `512` chars
  - App path value: `512` chars
  - Shell command value: `512` chars
  - System action id: `80` chars
- Required fields are validated before save.

## Tech Stack
- Electron
- React
- Vite

## Requirements
- macOS (primary target)
- Node.js `20.19+` or `22.12+`
- npm `10+` recommended

## Quick Start (Step-by-Step)
1. Clone and enter project:
```bash
git clone <your-repo-url>
cd chabi
```
2. Install dependencies:
```bash
npm install
```
3. Start development mode:
```bash
npm run dev
```
4. Build production assets:
```bash
npm run build
```
5. Run app with built assets:
```bash
npm run start
```

## Daily Development Steps
1. Run `npm run dev`.
2. Open Chabi from tray icon.
3. Add/Edit actions in the main panel.
4. Use `Record` to capture shortcut combos.
5. Press your Quick Bar toggle shortcut to run pinned actions quickly.

## Keyboard and Shortcut Notes
- Core shortcuts:
  - Toggle Chabi: `CommandOrControl+Shift+K`
  - Toggle Quick Bar: `CommandOrControl+Shift+L`
- Action shortcuts use Electron accelerator format.
- If a shortcut is taken by macOS/another app, it may fail to register.

## Example Actions

### URL
- `https://github.com`

### App
- Terminal: `/System/Applications/Utilities/Terminal.app`
- VS Code: `/Applications/Visual Studio Code.app`

### Bash/Shell
```bash
open -na "Visual Studio Code"
```
```bash
open -a "Brave Browser" https://github.com
```
```bash
say "Shortcut triggered"
```

## Data Storage
Chabi stores data in Electron `userData` directory:
- `actions.json`
- `settings.json`
- `action-stats.json`

## Import / Export
- Use **Export** to save actions as JSON.
- Use **Import** to load actions from JSON.
- Imported actions are sanitized and re-registered for shortcuts.

## Project Structure
- `electron/main.cjs` - Electron main process (windows, tray, IPC, shortcuts, actions)
- `electron/preload.cjs` - Secure renderer bridge (`window.chabi` API)
- `src/App.jsx` - Main panel UI and action management
- `src/quickbar/QuickBar.jsx` - Floating quick launcher UI
- `src/styles.css` - Main app styles
- `src/quickbar.css` - Quick Bar styles
- `src/utils/shortcutDisplay.js` - Shortcut display formatting

## Troubleshooting
- Shortcut not working:
  - Check Shortcut Conflicts card.
  - Try a less common combo.
- Shell action blocked:
  - Disable safe shell mode, or trust action on first run dialog.
- App action fails:
  - Verify the app path still exists.
- UI not updating as expected:
  - Restart dev server (`Ctrl+C`, then `npm run dev`).

## Scripts
- `npm run dev` - Vite + Electron dev workflow
- `npm run build` - Build renderer assets
- `npm run start` - Start Electron app
- `npm run dist` - Build local macOS `.dmg` + `.zip` into `release/`
- `npm run release:ci` - CI release build + publish to GitHub Release

## Release Standard
### Local release build (manual)
1. Bump version in `package.json` (for example `0.1.1`).
2. Run:
```bash
npm install
npm run dist
```
3. Release artifacts will be generated in `release/`.

### GitHub release build (recommended)
This repo has a workflow at `.github/workflows/release.yml` that runs on version tags.

1. Commit your release changes.
2. Create and push a tag:
```bash
git tag v0.1.0
git push origin v0.1.0
```
3. GitHub Actions builds `.dmg` and `.zip` and uploads them to a draft GitHub Release.

### Signing and notarization (later upgrade)
Current setup is great for first public distribution. For trusted macOS install UX, add Apple signing/notarization in a later step.

## License
Private project for now.
