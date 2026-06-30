import assert from "node:assert/strict";
import {
  reconcileProviderResults,
  type ProviderResultObservation,
  type ProviderResultRun,
  type ResultProviderName,
} from "./result-provider";

function observation(
  provider: ResultProviderName,
  status: "LIVE" | "FINISHED",
  homeScore: number,
  awayScore: number,
): ProviderResultObservation {
  return {
    provider,
    externalFixtureId: provider === "football-data.org" ? "fd-1" : "af-1",
    globalMatchId: "global-match-1",
    sourceKey: "world-cup-match-1",
    homeTeam: "Germany",
    awayTeam: "Paraguay",
    startsAt: new Date("2026-06-29T20:30:00.000Z"),
    previous: {
      status: "SCHEDULED",
      homeScore: null,
      awayScore: null,
      updatedAt: new Date("2026-06-29T20:00:00.000Z"),
    },
    next: { status, homeScore, awayScore },
  };
}

function run(
  provider: ResultProviderName,
  resultObservation: ProviderResultObservation,
): ProviderResultRun {
  return {
    checked: 1,
    received: 1,
    matched: 1,
    observations: [resultObservation],
    skippedFinished: [],
    source: provider,
  };
}

const agreement = reconcileProviderResults([
  run("football-data.org", observation("football-data.org", "LIVE", 1, 1)),
  run("API-Football", observation("API-Football", "LIVE", 1, 1)),
]);
assert.equal(agreement.accepted.length, 1);
assert.equal(agreement.accepted[0].decision, "providerAgreement");
assert.equal(agreement.conflicts.length, 0);

const conflict = reconcileProviderResults([
  run("football-data.org", observation("football-data.org", "LIVE", 2, 1)),
  run("API-Football", observation("API-Football", "LIVE", 1, 1)),
]);
assert.equal(conflict.accepted.length, 0);
assert.equal(conflict.conflicts.length, 1);

const singleProvider = reconcileProviderResults([
  run("football-data.org", observation("football-data.org", "LIVE", 1, 1)),
]);
assert.equal(singleProvider.accepted.length, 1);
assert.equal(singleProvider.accepted[0].decision, "singleProvider");
assert.equal(singleProvider.conflicts.length, 0);

console.log("Result provider reconciliation tests passed.");
