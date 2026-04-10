# Cutting a release

## Prerequisites

- Local clone up to date with `origin/main`.
- `gh` CLI logged in.
- A clear head. Releases on Friday afternoon are a bad idea.

## Steps

```bash
git checkout main
git pull
npm ci
make release-check    # runs: test + typecheck + lint + validate + build
```

If any of those fail, **stop**. Fix before tagging.

Pick the new version — semver applies:

- **Patch** (`1.2.3 → 1.2.4`) — bug fix, doc fix, visual tweak.
- **Minor** (`1.2.3 → 1.3.0`) — new feature, non-breaking library change.
- **Major** (`1.2.3 → 2.0.0`) — breaking change to the JSON schema or library API. Requires a parallel `/api/v2/` endpoint for at least 6 months per ADR-0003.

```bash
npm version <major|minor|patch> --no-git-tag-version
# update the "Changelog" section at the bottom of README.md
git add package.json README.md
git commit -m "release vX.Y.Z"
git push origin main
```

Wait for the deploy workflow to go green, then tag:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
gh release create vX.Y.Z --generate-notes --title "vX.Y.Z — <one-line>"
```

If the change affects client libraries, publish them per `libraries/<lang>/README.md`. Library versions are independent — they don't all have to bump at once.

## Rollback

If the release made the live site worse, follow [`rollback.md`](./rollback.md).
