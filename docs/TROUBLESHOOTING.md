# Troubleshooting

## Shortcut not working
- Check shortcut conflicts in app diagnostics.
- Try a less common key combo.

## Shell action blocked
- Safe shell mode may require first-run approval.

## App action fails
- Verify app path exists and is accessible.

## UI issue after changes
- Restart dev process:
```bash
npm run dev
```

## Release build fails
- Ensure internet access for Electron binary download.
- Retry with:
```bash
npm run dist
```
