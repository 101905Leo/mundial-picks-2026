type Score = {
  homeScore: number;
  awayScore: number;
};

function winner(score: Score) {
  if (score.homeScore > score.awayScore) return "HOME";
  if (score.homeScore < score.awayScore) return "AWAY";
  return "DRAW";
}

function goalDifference(score: Score) {
  return Math.abs(score.homeScore - score.awayScore);
}

export function calculatePredictionPoints(prediction: Score, result: Score) {
  if (prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore) {
    return 5;
  }

  if (winner(prediction) === winner(result)) {
    return 3;
  }

  if (goalDifference(prediction) === goalDifference(result)) {
    return 2;
  }

  return 1;
}
