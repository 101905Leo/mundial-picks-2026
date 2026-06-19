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

## Smoke Test Manual De Lectura - 2026-06-19

Scope:

- Manual read-only validation.
- No data writes.
- No recalculations.
- No cron/result updates.
- No payment actions.

### Super Usuario Global

- `/api/auth/me` returns `User.role === "ADMIN"`.
- Room, ranking, and matches load with HTTP `200`.
- No data writes were performed.

Result: passed for read-only global admin access.

### Admin De Sala

- User: `Leoavella`.
- `User.role === "USER"`.
- User is a room admin through `LeagueMembership`, not a global super user.
- `/api/admin/users` returns HTTP `403`.
- `/api/admin/rooms` returns HTTP `403`.
- Room, ranking, and matches load with HTTP `200`.
- No data writes were performed.

Result: passed. Room admin does not receive global admin permissions.

### Participante Normal

- User: `Sebastián avella`.
- `User.role === "USER"`.
- `isActive === false`.
- Room, ranking, and matches load with HTTP `200`.
- User does not see global admin tools.
- No data writes were performed.

Result: passed for read-only participant access.

### Summary

- Global super user read access works.
- Room admin remains separate from global admin.
- Normal participant read access works even with `isActive === false`.
- No production data was modified during this read-only smoke test.

## Smoke Test Manual De Escritura Pick Propio - 2026-06-19

Scope:

- Manual controlled write test for a normal user's own pick.
- No admin-pick flow was used.
- No recalculation was executed.
- No ranking, cron, or payment action was executed.

### Usuario

- User: `Sebastián avella`.
- `userId: cmq9t1i0i0001jr04eoav6hat`.
- `User.role === "USER"`.
- Room membership role: `MEMBER`.

### Sala

- Room: `familia avella`.
- `leagueId: cmq9oosaa0001jo04h0u7htg7`.

### Pick Guardado

- Match: `Scotland vs Morocco`.
- `matchId: cmqec4b1t001njl04ly68njuc`.
- Saved score: `8 - 2`.
- `predictionId: cmqlf29bj0001stjp30aotueh`.
- `points: 0`.

### Verificaciones

- `leagueId` was correctly saved as `cmq9oosaa0001jo04h0u7htg7`.
- `roomKey` was correctly saved as `cmq9oosaa0001jo04h0u7htg7`.
- `GLOBAL_OR_WITHOUT_LEAGUE_COUNT: 0`.
- No global pick was created.
- No pick without league was created.
- No recalculation was executed.
- Admin pick flow was not touched.
- Ranking, cron, and payments were not touched.

Result: passed for normal user own-pick write scope.

### Riesgo Observado

- Duplicate matches exist in calendar/imported data for some fixtures, including `Scotland vs Morocco`.
- This was not corrected in this phase.
- Track as technical debt for a later calendar/import stabilization phase.
