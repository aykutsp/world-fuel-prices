# Rollback

## Symptom

A deploy made the live site worse. You need the last known good build back on the live URL now, not after another full CI run.

## Option 1 — revert the bad commit (preferred)

Fast, audited, leaves a trail in git.

```bash
git checkout main
git pull
git log --oneline -10      # find the bad SHA
git revert <bad-sha>
git push origin main
```

The deploy workflow picks this up within a couple of minutes.

## Option 2 — re-run a previous successful workflow

Use if the bad change was *only* in CI config / dependency bumps.

1. Actions tab → find the most recent successful `Build and deploy` run.
2. "Re-run all jobs".

## Option 3 — force-push the previous tag

Only in a real emergency, and only with `--force-with-lease`.

```bash
git checkout main
git reset --hard <last-known-good-sha>
git push --force-with-lease origin main
```

Tell any contributors with branches based on `main` that they need to rebase.

## After rollback

1. Hard-refresh the live site (`Ctrl+F5`) to confirm.
2. Open an issue with the rollback SHA and a short post-mortem.
3. Add a test for whatever broke, if a test would have caught it.
4. Fix forward — either in a new commit or a PR that properly redoes the feature.

## Don't

- Don't `git push --force` without `--force-with-lease`.
- Don't edit files in GitHub's web UI during an incident.
- Don't skip the post-mortem because "it's over now".
