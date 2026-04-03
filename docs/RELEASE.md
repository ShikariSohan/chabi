# Release Guide

## Local Build
```bash
npm install
npm run dist
```
Artifacts are generated in `release/`.

## GitHub Release (Standard)
1. Ensure changes are pushed to `main`.
2. Bump version in `package.json`.
3. Tag and push:
```bash
git tag v0.1.1
git push origin v0.1.1
```
4. GitHub Actions workflow `.github/workflows/release.yml` builds `.dmg` + `.zip` and uploads to draft release.

## Signing (Later)
For smoother macOS install trust, add Apple Developer signing + notarization in CI.
