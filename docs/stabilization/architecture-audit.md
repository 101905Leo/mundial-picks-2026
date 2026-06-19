# Architecture Audit

## Current State

Mundial Picks 2026 is active and has real users, rooms, picks, ranking data, and production risk. The current application must remain operational while weak areas are stabilized and rebuilt in phases.

The current database schema and scoring rules can be maintained for now. The risky areas are not isolated enough, especially around room scope, picks, ranking, cron/results, and large UI components.

Current stabilization references:

- Probable production stable commit: `f8f2169`
- Local frozen commit: `d350184`
- Production baseline tag: `stable-prod-before-rebuild-20260619`
- Local baseline tag: `stable-local-before-rebuild-20260619`

## Roles

### Super Usuario Global

- Identified by `User.role === "ADMIN"`.
- Authenticated admin-only actions use `requireAdmin()`.
- Can administer the platform globally.
- Should not compete as a room participant.
- Should use admin flows for participant pick corrections.

Risk: global admin and room admin both use the word `ADMIN` in different contexts, which can lead to incorrect permission assumptions.

### Admin De Sala

- Identified by `LeagueMembership.role === "ADMIN"` or room ownership through `League.ownerId`.
- Can manage a specific room.
- Can be a participant in that room.
- Should not automatically have global platform powers.

Risk: room admin behavior is mixed with global admin checks in some UI and endpoint flows.

### Participante Normal

- Identified by `User.role === "USER"` and membership in a room.
- Can enter rooms where they are a member.
- Can save only their own pick.
- Must not see hidden picks before visibility rules allow it.

Risk: normal participant privacy can be affected if admin visibility logic leaks into normal endpoints or UI.

## Critical Flows

### Login

- Main files: `src/app/api/auth/login/route.ts`, `src/app/api/auth/me/route.ts`, `src/lib/auth.ts`.
- Uses JWT cookie and `JWT_SECRET`.
- May join a room by invite code during login.
- Super user can enter as a spectator without room membership.

Status: foundation is usable.

### Sala

- Main models: `League`, `LeagueMembership`, `Match`.
- Main identifiers:
  - `League.id`: room id.
  - `Match.roomId`: match belongs to a room.
  - `Prediction.leagueId`: prediction belongs to a room.
  - `Prediction.roomKey`: denormalized prediction scope, often room id or `GLOBAL`.

Status: works, but field naming is structurally weak.

### Pick Propio

- Main endpoint: `src/app/api/predictions/route.ts`.
- Normal users save their own pick.
- Super user is blocked from this flow and directed to admin tools.

Status: should be kept separate from admin pick flow.

### Pick Admin

- Main endpoint: `src/app/api/admin/predictions/route.ts`.
- Main UI: `src/components/admin-panel.tsx`.
- Super user can create or edit a participant's pick.
- Must save with the participant `userId`, not the super user's id.
- Must include `leagueId` for room picks.

Status: critical but recently stabilized.

### Lectura De Picks

- Normal room endpoint: `src/app/api/leagues/[id]/predictions/route.ts`.
- Admin room dashboard: `src/app/api/admin/rooms/[id]/dashboard/route.ts`.
- Normal users must keep privacy restrictions.
- Super user may need broader visibility through admin-only paths.

Status: zone critical because visibility, room scope, and missing participants are mixed.

### Ranking

- Main endpoint: `src/app/api/leagues/[id]/ranking/route.ts`.
- Depends on correct `Prediction.matchId`, `Prediction.leagueId`, `Prediction.roomKey`, and `Match.roomId`.

Status: zone critical. Scoring can be correct while ranking is wrong if room associations are wrong.

### Scoring

- Main files: `src/lib/scoring.ts`, `src/lib/prediction-points.ts`, `src/lib/room-scoring.ts`.
- Current point rules are centralized and should not be changed during stabilization.
- Phase 1 confirmed the current live-scoring rule: a `SCHEDULED` match that already started and has `homeScore` and `awayScore` can be treated as puntuable.
- A failing scoring test was updated in commit `f288337` because the test expected old behavior.
- No scoring logic was changed.

Status: base solid, with the requirement that future scoring behavior must remain protected by tests before any module rebuild touches picks or ranking.

### Cron / Resultados

- Main files: `src/app/api/cron/update-results/route.ts`, `src/app/api/admin/update-results/route.ts`, `src/lib/automatic-results.ts`, `src/lib/sync-room-results.ts`.
- Cron exists in `vercel.json`.
- Results sync can update matches and trigger recalculation.

Status: zone critical. Do not run real recalculations without backup and approval.

### Pagos

- Main files include Wompi-related routes and `src/lib/wompi.ts`.
- Payments affect room activation, plan, participant limits, and expiration.

Status: zone critical. Keep separate from UI, picks, ranking, and rebuild phases.

## Weak Components

### `src/components/league-panel.tsx`

- Handles room selection, room home, featured match, picks, ranking, calendar, chat, participants, room admin controls, super user conditions, and mobile navigation.
- Too many responsibilities in one component.

Classification: weak wall. Rebuild by extracting modules gradually.

### `src/components/admin-panel.tsx`

- Handles rooms, users, room dashboard, participant inspection, admin predictions, tools, WhatsApp test, and platform maintenance.
- Too many unrelated actions in one component.

Classification: weak wall. Rebuild by extracting admin modules gradually.

## Critical Zones

- Picks.
- Ranking.
- Scoring.
- Cron/results.
- Payments.
- `leagueId`, `roomId`, `roomKey`.
- Room membership and role checks.
- Admin visibility versus participant privacy.

## What To Keep

- Current schema for now.
- Current scoring rules.
- Current scoring helpers, with tests covering future scheduled matches without score and started scheduled matches with score.
- Auth/session foundation.
- Normal pick endpoint for user-owned picks.
- Admin pick endpoint for super user administrative picks.
- Existing production app while active users are present.

## What To Rebuild By Modules

- Permission helpers.
- Pick read models.
- Admin panel modules.
- Room panel modules.
- Room scope helpers around `leagueId`, `roomId`, and `roomKey`.
- Smoke-test and rollback discipline before changes.
