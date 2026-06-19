# Rebuild Roadmap

## Phase 0 - Freeze Production

Objective:

- Preserve the current working production state.
- Establish stable Git references and rollback plan.

Likely files touched:

- Documentation only.

Forbidden files:

- `prisma/schema.prisma`
- Components.
- API endpoints.
- Scoring.
- Ranking.
- Cron.
- Payments.

Risk:

- Low if documentation only.

Acceptance criteria:

- Stable tags exist.
- Rollback plan exists.
- No code behavior changed.

## Phase 1 - Smoke Tests

Objective:

- Define and run safe smoke checks before touching modules.

Likely files touched:

- `docs/stabilization/smoke-tests.md`
- Future optional read-only test scripts, only after approval.

Forbidden files:

- Production data.
- Repair scripts against production.
- Recalculate endpoints.

Risk:

- Low for read-only checks.
- High for write tests against production.

Acceptance criteria:

- Auth, room, picks, ranking, and admin-pick flows have documented checks.
- Write tests are limited to local or staging unless approved.

## Phase 2 - Separate Permission Helpers

Objective:

- Centralize role decisions without changing behavior.
- Make global super user, room admin, room owner, and normal participant explicit.

Likely files touched:

- New or existing permission helper under `src/lib`.
- Endpoints only where permission duplication is proven.

Forbidden files:

- Scoring rules.
- Ranking calculation.
- Payments.
- Prisma schema.

Risk:

- Medium because permission changes can expose data or block valid users.

Acceptance criteria:

- No behavior change.
- Same users can access the same flows as before.
- Permission checks are easier to audit.

## Phase 3 - Separate Picks

Objective:

- Separate normal pick save, admin pick save, normal pick read, super-admin pick read, and scoring.

Likely files touched:

- `src/app/api/predictions/route.ts`
- `src/app/api/admin/predictions/route.ts`
- `src/app/api/leagues/[id]/predictions/route.ts`
- `src/app/api/admin/rooms/[id]/dashboard/route.ts`
- New pick helper modules under `src/lib`, if approved.

Forbidden files:

- Scoring rules unless the change is only a read-only import/use.
- Prisma schema.
- UI redesign.

Risk:

- High because picks affect ranking and privacy.

Acceptance criteria:

- Normal user saves only own pick.
- Super user saves participant pick only through admin flow.
- Normal visibility rules remain unchanged.
- Super-admin visibility is admin-only.
- Room picks never fall back to `GLOBAL`.

## Phase 4 - Rebuild Admin Panel By Modules

Objective:

- Split `src/components/admin-panel.tsx` into focused modules.

Likely files touched:

- `src/components/admin-panel.tsx`
- New admin subcomponents, after approval.

Forbidden files:

- Endpoints unless a real backend bug is found.
- Scoring.
- Ranking.
- Payments.

Risk:

- Medium. UI split can break forms if payloads change.

Acceptance criteria:

- Existing admin flows still work.
- No duplicated forms.
- Admin pick form continues using `/api/admin/predictions`.
- No feature changes during extraction.

## Phase 5 - Rebuild Room Panel By Modules

Objective:

- Split `src/components/league-panel.tsx` into room home, picks, ranking, calendar, chat, participants, and admin-room modules.

Likely files touched:

- `src/components/league-panel.tsx`
- New room subcomponents, after approval.

Forbidden files:

- Backend endpoints unless a blocking issue is diagnosed.
- Scoring.
- Ranking.
- Prisma schema.

Risk:

- High because this panel mixes normal user, room admin, and super user flows.

Acceptance criteria:

- Featured match behavior unchanged.
- Pick own flow unchanged.
- Admin pick flow is not reintroduced into the featured card.
- Normal users do not gain extra visibility.
- Super user retains approved admin visibility.

## Phase 6 - Gradual Migration

Objective:

- Move from old pieces to new modules without interrupting the active room.

Likely files touched:

- Module-specific files approved per phase.

Forbidden files:

- Production data.
- Prisma schema without migration plan.
- Recalculation scripts without dry-run and approval.

Risk:

- Medium to high depending on module.

Acceptance criteria:

- Old and new outputs match for critical flows.
- Rollback path remains clear.
- Active room users are not interrupted.

## Phase 7 - Clean Old Code

Objective:

- Remove dead code, duplicate helpers, unsafe fallbacks, and obsolete UI only after replacements are proven.

Likely files touched:

- Legacy component blocks.
- Legacy helpers.
- Obsolete documentation.

Forbidden files:

- Active production flows unless covered by tests.
- Schema destructive changes without migration and backup.

Risk:

- Medium. Cleanup can accidentally remove still-used behavior.

Acceptance criteria:

- No references remain to removed code.
- Build passes.
- Smoke tests pass.
- Rollback tag remains available.
