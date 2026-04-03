# Release Context

## Current Release Tooling
- `electron-builder` configured in `package.json`
- GitHub Actions release workflow: `.github/workflows/release.yml`

## Artifact Targets
- `.dmg`
- `.zip`

## Versioning
- SemVer (`MAJOR.MINOR.PATCH`)
- Use tags like `v0.1.1`

## Practical Rule
For each release:
1. Confirm app runs locally.
2. Run `npm run dist` once.
3. Tag and push release version.
4. Verify GitHub release artifacts exist.
5. Update README download links (`latest`, `.dmg`, `.zip`) if version-specific links are used.
6. Keep `docs/RELEASE.md` and `README.md` release instructions in sync.

## Documentation Sync Rule
When anything in release tooling changes (`package.json` scripts, workflow file, artifact names, or version tag format), update all of:
- `README.md`
- `docs/RELEASE.md`
- this file (`ai-context/20-RELEASE-CONTEXT.md`)
