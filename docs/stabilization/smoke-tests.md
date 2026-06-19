# Smoke Tests

These checks protect the active room and real user data before modular rebuild work begins.

## Safe Read-Only Tests

These can be executed against local or staging without modifying data. Against production, only run with explicit approval.

### Auth

- [ ] Super user can log in.
- [ ] Normal user can log in.
- [ ] `/api/auth/me` returns the correct authenticated user.
- [ ] Super user is identified as `role === "ADMIN"`.
- [ ] Normal user is identified as `role === "USER"`.

### Active Room

- [ ] Normal user sees their active room.
- [ ] Normal user does not see admin-only data.
- [ ] Super user can view rooms through admin/global flow.
- [ ] Room invite code still resolves to the expected room.

### Picks Visibility

- [ ] Normal user keeps existing privacy behavior before match visibility opens.
- [ ] Super user sees admin-only pick visibility only in authorized admin/super-user locations.
- [ ] Participants without a pick are displayed as missing where the admin view expects it.

### Ranking

- [ ] Room ranking loads.
- [ ] Ranking is scoped to the room.
- [ ] Ranking does not include other rooms.
- [ ] A `SCHEDULED` match without score does not add points.

### Results / Cron Read Checks

- [ ] Cron configuration exists.
- [ ] Result update routes are not manually executed during read-only smoke checks.
- [ ] No real recalculation is triggered.

## Write Tests For Local Or Staging Only

These tests write data. Do not run them against production unless there is a backup and explicit approval.

### Pick Propio

- [ ] Normal user saves their own pick.
- [ ] Pick is saved with the active room `leagueId`.
- [ ] Pick is not saved as `GLOBAL`.
- [ ] Pick appears in the correct room context.
- [ ] Pick does not appear in another room.

### Pick Admin

- [ ] Super user saves a pick for a participant from the admin panel.
- [ ] Payload includes `userId`, `leagueId`, `matchId`, `homeScore`, and `awayScore`.
- [ ] Saved pick belongs to the participant target, not the super user.
- [ ] Saved pick includes the room `leagueId`.
- [ ] Saved pick does not use `roomKey: GLOBAL` for a room pick.
- [ ] Admin pick does not affect the normal featured-match card flow.

### Room Actions

- [ ] Join room by code works for a normal user.
- [ ] Creating a room works only in local or staging with test data.
- [ ] Publishing or hiding a match is tested only outside production.

## Prohibited In Production Without Backup

- [ ] Do not run real point recalculation.
- [ ] Do not run repair scripts.
- [ ] Do not run historical pick migration scripts.
- [ ] Do not run destructive admin room actions.
- [ ] Do not modify Prisma schema.
- [ ] Do not run migrations.
- [ ] Do not manually alter production rows.
- [ ] Do not test payments with real production side effects unless the payment phase is explicitly approved.

## Build And Static Checks

Safe local checks:

```bash
./node_modules/.bin/tsc --noEmit
npm run build
npm run test:scoring
```

Do not use these checks as proof that production data is safe. They only validate compilation and scoring behavior.

## Phase 1 Result - 2026-06-19

Executed checks:

```bash
./node_modules/.bin/tsc --noEmit
npm run build
npm run test:scoring
git status -sb
```

Result:

- TypeScript passed.
- Build passed.
- `npm run test:scoring` initially failed because one test expected `0` for a `SCHEDULED` match that had already started and had a score.
- The failure was caused by an outdated test, not by a scoring bug.
- Only `src/lib/scoring.test.ts` was updated.
- Scoring logic was not changed.
- After the test update, `npm run test:scoring` passed with `Scoring tests passed`.
- `tsconfig.tsbuildinfo` was modified by build and restored.
- Working tree was clean after commit `f288337 Actualizar pruebas de scoring programado iniciado`.

Current scoring smoke-test rule:

- Future `SCHEDULED` match without score returns `0`.
- Started `SCHEDULED` match with available score is puntuable.
- Exact pick for a started `SCHEDULED` match with score returns `5`.

Next Phase 1 step:

- Create or run local/staging smoke checks for auth, active room access, own pick, admin pick, pick visibility, and ranking without touching production.
