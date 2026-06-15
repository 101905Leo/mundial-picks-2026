import { MatchStatus } from "@prisma/client";
import { calculatePredictionPoints } from "@/lib/scoring";

type PredictionScore = {
  homeScore: number;
  awayScore: number;
  points: number;
  manualPoints?: number | null;
  updatedAt?: Date | string;
};

type MatchScore = {
  status: MatchStatus | "SCHEDULED" | "LIVE" | "FINISHED";
  homeScore: number | null;
  awayScore: number | null;
  updatedAt?: Date | string;
};

function timestamp(value?: Date | string) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function shouldUseManualPoints(prediction: PredictionScore, match: MatchScore) {
  if (prediction.manualPoints === null || prediction.manualPoints === undefined) return false;

  const predictionUpdatedAt = timestamp(prediction.updatedAt);
  const matchUpdatedAt = timestamp(match.updatedAt);

  if (!predictionUpdatedAt || !matchUpdatedAt) return true;
  return predictionUpdatedAt >= matchUpdatedAt;
}

export function visiblePredictionPoints(prediction: PredictionScore, match: MatchScore) {
  if (shouldUseManualPoints(prediction, match)) {
    return prediction.manualPoints!;
  }

  if (match.homeScore !== null && match.awayScore !== null) {
    return calculatePredictionPoints(
      { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
      { homeScore: match.homeScore, awayScore: match.awayScore },
    );
  }

  return prediction.points;
}
