type Score = {
  homeScore: number;
  awayScore: number;
};

export type PredictionOutcome = "EXACT" | "GOAL_DIFFERENCE" | "WINNER" | "PARTICIPATION";
export type ScoringStatus = "SCHEDULED" | "LIVE" | "FINISHED";

type MatchForScoringStatus = {
  status: ScoringStatus;
  startsAt?: Date | string;
  homeScore: number | null;
  awayScore: number | null;
};

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

export function getScoringStatus(match: MatchForScoringStatus, now = new Date()): ScoringStatus {
  const status = String(match.status).trim().toUpperCase();
  const hasScore = match.homeScore !== null && match.awayScore !== null;
  const startsAt = match.startsAt ? (match.startsAt instanceof Date ? match.startsAt : new Date(match.startsAt)) : null;
  const started = startsAt !== null && !Number.isNaN(startsAt.getTime()) && startsAt.getTime() <= now.getTime();

  if (status === "SCHEDULED" && hasScore && started) {
    return "LIVE";
  }

  if (status === "LIVE" || status === "FINISHED") return status;
  return "SCHEDULED";
}

export function hasScoringScore(match: MatchForScoringStatus, now = new Date()) {
  const scoringStatus = getScoringStatus(match, now);
  return (
    (scoringStatus === "LIVE" || scoringStatus === "FINISHED") &&
    match.homeScore !== null &&
    match.awayScore !== null
  );
}
