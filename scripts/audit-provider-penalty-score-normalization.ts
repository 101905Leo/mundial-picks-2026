import assert from "node:assert/strict";
import {
  normalizeProviderScoreWithoutPenalties,
  type ProviderScoreCandidate,
  type ProviderScoreValue,
} from "../src/lib/provider-score-normalization";

type AuditCase = {
  name: string;
  candidates: ProviderScoreCandidate[];
  penalties?: ProviderScoreValue | null;
  expected: { home: number; away: number };
};

const cases: AuditCase[] = [
  {
    name: "Switzerland 0-0 Colombia, penalties 4-3",
    candidates: [{ label: "fullTime", score: { home: 4, away: 3 } }],
    penalties: { home: 4, away: 3 },
    expected: { home: 0, away: 0 },
  },
  {
    name: "Australia 1-1 Egypt, penalties 2-4",
    candidates: [{ label: "fullTime", score: { home: 3, away: 5 } }],
    penalties: { home: 2, away: 4 },
    expected: { home: 1, away: 1 },
  },
  {
    name: "Germany 1-1 Paraguay, penalties 3-4",
    candidates: [{ label: "fullTime", score: { home: 4, away: 5 } }],
    penalties: { home: 3, away: 4 },
    expected: { home: 1, away: 1 },
  },
  {
    name: "Netherlands 1-1 Morocco, penalties 2-3",
    candidates: [{ label: "fullTime", score: { home: 3, away: 4 } }],
    penalties: { home: 2, away: 3 },
    expected: { home: 1, away: 1 },
  },
  {
    name: "Provider already exposes score without penalties",
    candidates: [{ label: "fullTime", score: { home: 1, away: 1 } }],
    penalties: { home: 2, away: 4 },
    expected: { home: 1, away: 1 },
  },
  {
    name: "Brazil 1-2 Norway, no penalties",
    candidates: [{ label: "fullTime", score: { home: 1, away: 2 } }],
    penalties: null,
    expected: { home: 1, away: 2 },
  },
];

const rows = cases.map((testCase) => {
  const normalized = normalizeProviderScoreWithoutPenalties(testCase.candidates, testCase.penalties);

  assert.equal(normalized.ambiguous, false, testCase.name);
  assert.equal(normalized.homeScore, testCase.expected.home, testCase.name);
  assert.equal(normalized.awayScore, testCase.expected.away, testCase.name);

  return {
    case: testCase.name,
    expected: `${testCase.expected.home}-${testCase.expected.away}`,
    obtained: `${normalized.homeScore}-${normalized.awayScore}`,
    source: normalized.source,
  };
});

console.table(rows);
console.log("OK: provider penalty scores are normalized without adding shootout goals.");
