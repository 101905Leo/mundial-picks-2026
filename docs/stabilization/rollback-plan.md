# Rollback Plan

## Baselines

Probable production stable commit:

```text
f8f2169 Corregir guardado admin de picks por sala
```

Local frozen commit:

```text
d350184 Permitir ver picks de sala al super usuario
```

Tags created:

```text
stable-prod-before-rebuild-20260619 -> f8f2169
stable-local-before-rebuild-20260619 -> d350184
```

## How To Return To Production Stable

Do not execute without explicit approval.

Recommended safe process:

1. Confirm the currently deployed Vercel commit.
2. Confirm production database backup exists.
3. Confirm no migration is pending.
4. Create a rollback branch from the stable production tag:

```bash
git checkout -b rollback/prod-stable stable-prod-before-rebuild-20260619
```

5. Build locally.
6. Deploy only after approval.

Do not force-reset production branches unless explicitly approved.

## What Not To Do

- Do not reset production without approval.
- Do not run `git reset --hard` as a default rollback method.
- Do not touch the real database without backup.
- Do not run real recalculates without approval.
- Do not run repair scripts against production.
- Do not modify Prisma schema without a migration plan.
- Do not deploy a local-only commit assuming it is already in production.
- Do not mix UI fixes with ranking, scoring, cron, payments, or schema changes.

## Checklist Before Any Deploy

- [ ] Confirm clean working tree.
- [ ] Confirm branch name.
- [ ] Confirm target commit.
- [ ] Confirm production database backup.
- [ ] Confirm rollback commit/tag.
- [ ] Confirm no accidental schema changes.
- [ ] Confirm no `.env` changes.
- [ ] Confirm smoke tests passed in local or staging.
- [ ] Confirm no real recalculates were executed unintentionally.
- [ ] Confirm user approval for deploy.

## Data Safety

Production data that must be protected:

- Active room.
- Room memberships.
- Predictions.
- Ranking state.
- Manual points.
- Matches and results.
- Payments and room activation fields.

If a future change touches `Prediction`, `Match`, `League`, or `LeagueMembership`, require backup, dry-run, and rollback plan first.
