# Features

## Product
- Menu bar app with frameless transparent UI designed for fast access.
- Floating Quick Bar for rapid command execution without opening full settings.
- Keyboard navigation in Quick Bar (`Up/Down/Enter/Esc`) for mouse-free flow.
- Action support for:
  - URL opens (websites, docs, dashboards)
  - Installed app launches
  - Bash/shell commands
  - System actions (sleep, lock, logout, restart, shutdown, and utility actions)

## Safety and Quality
- Global shortcut recording with accelerator validation.
- Duplicate and unavailable shortcut detection.
- Shortcut conflict diagnostics for app-level visibility.
- Action health diagnostics for missing values, invalid targets, and failed shell runs.
- Safe shell mode:
  - first-run confirmation
  - trust-once or always-trust flow
- Risky system action confirmation for destructive operations.

## Productivity
- Import/export actions as JSON for backup and migration.
- Launch-at-login toggle for always-ready workflow.
- Usage-based Quick Bar ranking (frequent/recent actions first).
- Pin/unpin actions for quick access.
- Action search and filtering in the main panel.

## Limits and Validation
- Max pinned actions: `8`
- All actions pagination: `8` per page
- Input limits:
  - Name: `60`
  - Shortcut: `64`
  - URL: `512`
  - App path: `512`
  - Shell command: `512`
  - System action id: `80`
