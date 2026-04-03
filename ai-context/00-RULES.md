# AI Rules (Read First)

Before making any code or docs change in this repo:

1. Read all `.md` files in `ai-context/`.
2. Follow constraints from these files before editing.
3. Preserve product direction: fast, minimal-friction launcher for macOS.
4. Keep UI changes aligned with glassy, compact style.
5. Do not commit generated folders (`node_modules/`, `dist/`, `release/`).
6. Prefer small, clear commits with conventional messages.
7. Update docs when behavior changes.
8. Keep `README.md`, `docs/*`, and `ai-context/*` synchronized when features, limits, scripts, or release flow changes.
9. If release version changes, update download links and version references in docs in the same change.
10. If new files/folders are introduced for workflow/context, add them to README navigation.

If there is a conflict, prioritize this order:
1. `00-RULES.md`
2. Other files in `ai-context/`
3. README and docs

## Mandatory Change Checklist
Before finishing any change, verify:
1. Product behavior change reflected in `docs/FEATURES.md` or `docs/USAGE.md`.
2. Architecture/file changes reflected in `docs/ARCHITECTURE.md`.
3. Release/process changes reflected in `docs/RELEASE.md`.
4. Public-facing quick links in `README.md` are still valid.
5. AI workflow/rules updates reflected in `ai-context/*` when relevant.
