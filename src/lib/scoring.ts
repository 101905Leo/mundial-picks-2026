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

  if (winner(prediction) === winner(result)) {
    return "WINNER";
  }

  if (goalDifference(prediction) === goalDifference(result)) {
    return "GOAL_DIFFERENCE";
  }

  return "PARTICIPATION";
}

export function calculatePredictionPoints(prediction: Score, result: Score) {
  const applicablePoints = [1];

  if (prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore) {
    applicablePoints.push(5);
  }

  if (winner(prediction) === winner(result)) {
    applicablePoints.push(3);
  }

  if (goalDifference(prediction) === goalDifference(result)) {
    applicablePoints.push(2);
  }

  return Math.max(...applicablePoints);
}

export function getScoringStatus(match: MatchForScoringStatus, now = new Date()): ScoringStatus {
  const status = String(match.status).trim().toUpperCase();
  const hasScore = match.homeScore !== null && match.awayScore !== null;
  const startsAt = match.startsAt ? (match.startsAt instanceof Date ? match.startsAt : new Date(match.startsAt)) : null;
  const elapsedMs = startsAt !== null && !Number.isNaN(startsAt.getTime()) ? now.getTime() - startsAt.getTime() : Number.NaN;
  const liveWindowMs = 120 * 60 * 1000;

  if (status === "SCHEDULED" && hasScore && elapsedMs >= 0 && elapsedMs <= liveWindowMs) {
    return "LIVE";
  }

  if (status === "SCHEDULED" && hasScore && elapsedMs > liveWindowMs) {
    return "FINISHED";
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
