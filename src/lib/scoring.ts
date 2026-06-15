type Score = {
  homeScore: number;
  awayScore: number;
};

export type PredictionOutcome = "EXACT" | "GOAL_DIFFERENCE" | "WINNER" | "PARTICIPATION";

function winner(score: Score) {
  if (score.homeScore > score.awayScore) return "HOME";
  if (score.homeScore < score.awayScore) return "AWAY";
  return "DRAW";
}

function goalDifference(score: Score) {
  return score.homeScore - score.awayScore;
}

export function getPredictionOutcome(prediction: Score, result: Score): PredictionOutcome {
  if (prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore) {
    return "EXACT";
  }

  if (goalDifference(prediction) === goalDifference(result)) {
    return "GOAL_DIFFERENCE";
  }

  if (winner(prediction) === winner(result)) {
    return "WINNER";
  }

  return "PARTICIPATION";
}

export function calculatePredictionPoints(prediction: Score, result: Score) {
  const outcome = getPredictionOutcome(prediction, result);

  if (outcome === "EXACT") {
    return 5;
  }

  if (outcome === "GOAL_DIFFERENCE") {
    return 2;
  }

  if (outcome === "WINNER") {
    return 3;
  }

  return 1;
}
