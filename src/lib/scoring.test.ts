import assert from "node:assert/strict";
import { calculatePredictionPoints } from "./scoring";

const colombiaMexico = { homeScore: 2, awayScore: 1 };
assert.equal(calculatePredictionPoints({ homeScore: 2, awayScore: 1 }, colombiaMexico), 5);
assert.equal(calculatePredictionPoints({ homeScore: 1, awayScore: 0 }, colombiaMexico), 2);
assert.equal(calculatePredictionPoints({ homeScore: 3, awayScore: 2 }, colombiaMexico), 2);
assert.equal(calculatePredictionPoints({ homeScore: 1, awayScore: 1 }, colombiaMexico), 1);
assert.equal(calculatePredictionPoints({ homeScore: 0, awayScore: 2 }, colombiaMexico), 1);
assert.equal(calculatePredictionPoints({ homeScore: 2, awayScore: 0 }, colombiaMexico), 3);

const spainBrazil = { homeScore: 1, awayScore: 1 };
assert.equal(calculatePredictionPoints({ homeScore: 1, awayScore: 1 }, spainBrazil), 5);
assert.equal(calculatePredictionPoints({ homeScore: 0, awayScore: 0 }, spainBrazil), 2);
assert.equal(calculatePredictionPoints({ homeScore: 2, awayScore: 2 }, spainBrazil), 2);
assert.equal(calculatePredictionPoints({ homeScore: 2, awayScore: 1 }, spainBrazil), 1);

console.log("Scoring tests passed");
