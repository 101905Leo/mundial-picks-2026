import assert from "node:assert/strict";
import { calculatePredictionPoints } from "./scoring";
import { rankingPredictionPoints } from "./prediction-points";
import { roomPredictionPoints } from "./room-scoring";

const colombiaMexico = { homeScore: 2, awayScore: 1 };
assert.equal(calculatePredictionPoints({ homeScore: 2, awayScore: 1 }, colombiaMexico), 5);
assert.equal(calculatePredictionPoints({ homeScore: 1, awayScore: 0 }, colombiaMexico), 3);
assert.equal(calculatePredictionPoints({ homeScore: 3, awayScore: 2 }, colombiaMexico), 3);
assert.equal(calculatePredictionPoints({ homeScore: 1, awayScore: 1 }, colombiaMexico), 1);
assert.equal(calculatePredictionPoints({ homeScore: 0, awayScore: 2 }, colombiaMexico), 1);
assert.equal(calculatePredictionPoints({ homeScore: 2, awayScore: 0 }, colombiaMexico), 3);

const spainBrazil = { homeScore: 1, awayScore: 1 };
assert.equal(calculatePredictionPoints({ homeScore: 1, awayScore: 1 }, spainBrazil), 5);
assert.equal(calculatePredictionPoints({ homeScore: 0, awayScore: 0 }, spainBrazil), 3);
assert.equal(calculatePredictionPoints({ homeScore: 2, awayScore: 2 }, spainBrazil), 3);
assert.equal(calculatePredictionPoints({ homeScore: 2, awayScore: 1 }, spainBrazil), 1);

const oneNilResult = { homeScore: 1, awayScore: 0 };
assert.equal(calculatePredictionPoints({ homeScore: 1, awayScore: 0 }, oneNilResult), 5);
assert.equal(calculatePredictionPoints({ homeScore: 3, awayScore: 1 }, oneNilResult), 3);
assert.equal(calculatePredictionPoints({ homeScore: 3, awayScore: 2 }, oneNilResult), 3);
assert.equal(calculatePredictionPoints({ homeScore: 0, awayScore: 1 }, oneNilResult), 1);

const oneNilPick = { homeScore: 1, awayScore: 0 };

assert.equal(
  rankingPredictionPoints(oneNilPick, {
    status: "LIVE",
    homeScore: 1,
    awayScore: 0,
  }),
  5,
);
assert.notEqual(
  rankingPredictionPoints(oneNilPick, {
    status: "LIVE",
    homeScore: 1,
    awayScore: 1,
  }),
  5,
);
assert.equal(
  rankingPredictionPoints(oneNilPick, {
    status: "LIVE",
    homeScore: 2,
    awayScore: 1,
  }),
  3,
);
assert.equal(
  rankingPredictionPoints({ homeScore: 2, awayScore: 1 }, {
    status: "FINISHED",
    homeScore: 2,
    awayScore: 1,
  }),
  5,
);
assert.equal(
  rankingPredictionPoints(oneNilPick, {
    status: "SCHEDULED",
    homeScore: null,
    awayScore: null,
  }),
  0,
);
assert.equal(
  roomPredictionPoints({ homeScore: 0, awayScore: 1 }, {
    homeTeam: "Belgium",
    awayTeam: "Egypt",
    startsAt: new Date(),
    status: "LIVE",
    homeScore: 0,
    awayScore: 1,
  }),
  5,
);
assert.equal(
  roomPredictionPoints({ homeScore: 0, awayScore: 1 }, {
    homeTeam: "Belgium",
    awayTeam: "Egypt",
    startsAt: new Date(Date.now() + 60 * 60 * 1000),
    status: "SCHEDULED",
    homeScore: null,
    awayScore: null,
  }),
  0,
);
assert.equal(
  roomPredictionPoints({ homeScore: 0, awayScore: 1 }, {
    homeTeam: "Belgium",
    awayTeam: "Egypt",
    startsAt: new Date(),
    status: "SCHEDULED",
    homeScore: 0,
    awayScore: 1,
  }),
  5,
);

console.log("Scoring tests passed");
