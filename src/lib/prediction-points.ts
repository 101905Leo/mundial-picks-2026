import { MatchStatus } from "@prisma/client";
import { calculatePredictionPoints } from "@/lib/scoring";

type PredictionScore = {
  homeScore: number;
  awayScore: number;
  points: number;
  manualPoints?: number | null;
};

type MatchScore = {
  status: MatchStatus | "SCHEDULED" | "LIVE" | "FINISHED";
  homeScore: number | null;
  awayScore: number | null;
};

export function visiblePredictionPoints(prediction: PredictionScore, match: MatchScore) {
  if (prediction.manualPoints !== null && prediction.manualPoints !== undefined) {
    return prediction.manualPoints;
  }

  if (
    (match.status === "LIVE" || match.status === "FINISHED") &&
    match.homeScore !== null &&
    match.awayScore !== null
  ) {
    return calculatePredictionPoints(
      { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
      { homeScore: match.homeScore, awayScore: match.awayScore },
    );
  }

  return prediction.points;
}
