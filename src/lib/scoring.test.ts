import assert from "node:assert/strict";
import { calculatePredictionPoints, getPredictionOutcome } from "./scoring";

const cases = [
  {
    name: "Colombia 2-1 Mexico: marcador exacto",
    result: { homeScore: 2, awayScore: 1 },
    prediction: { homeScore: 2, awayScore: 1 },
    points: 5,
    outcome: "EXACT",
  },
  {
    name: "Colombia 2-1 Mexico: diferencia correcta 1-0",
    result: { homeScore: 2, awayScore: 1 },
    prediction: { homeScore: 1, awayScore: 0 },
    points: 2,
    outcome: "GOAL_DIFFERENCE",
  },
  {
    name: "Colombia 2-1 Mexico: diferencia correcta 3-2",
    result: { homeScore: 2, awayScore: 1 },
    prediction: { homeScore: 3, awayScore: 2 },
    points: 2,
    outcome: "GOAL_DIFFERENCE",
  },
  {
    name: "Colombia 2-1 Mexico: participacion por empate incorrecto",
    result: { homeScore: 2, awayScore: 1 },
    prediction: { homeScore: 1, awayScore: 1 },
    points: 1,
    outcome: "PARTICIPATION",
  },
  {
    name: "Colombia 2-1 Mexico: participacion por ganador incorrecto",
    result: { homeScore: 2, awayScore: 1 },
    prediction: { homeScore: 0, awayScore: 2 },
    points: 1,
    outcome: "PARTICIPATION",
  },
  {
    name: "Colombia 2-1 Mexico: ganador correcto",
    result: { homeScore: 2, awayScore: 1 },
    prediction: { homeScore: 2, awayScore: 0 },
    points: 3,
    outcome: "WINNER",
  },
  {
    name: "Espana 1-1 Brasil: marcador exacto",
    result: { homeScore: 1, awayScore: 1 },
    prediction: { homeScore: 1, awayScore: 1 },
    points: 5,
    outcome: "EXACT",
  },
  {
    name: "Espana 1-1 Brasil: diferencia correcta 0-0",
    result: { homeScore: 1, awayScore: 1 },
    prediction: { homeScore: 0, awayScore: 0 },
    points: 2,
    outcome: "GOAL_DIFFERENCE",
  },
  {
    name: "Espana 1-1 Brasil: diferencia correcta 2-2",
    result: { homeScore: 1, awayScore: 1 },
    prediction: { homeScore: 2, awayScore: 2 },
    points: 2,
    outcome: "GOAL_DIFFERENCE",
  },
  {
    name: "Espana 1-1 Brasil: participacion por fallar empate",
    result: { homeScore: 1, awayScore: 1 },
    prediction: { homeScore: 2, awayScore: 1 },
    points: 1,
    outcome: "PARTICIPATION",
  },
] as const;

for (const testCase of cases) {
  assert.equal(calculatePredictionPoints(testCase.prediction, testCase.result), testCase.points, testCase.name);
  assert.equal(getPredictionOutcome(testCase.prediction, testCase.result), testCase.outcome, testCase.name);
}

console.log("Scoring tests passed.");
