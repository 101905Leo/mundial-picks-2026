import { calculatePredictionPoints, hasScoringScore } from "@/lib/scoring";
import { resolveEffectiveMatchScore, sameMatchByTeamsAndKickoff } from "@/lib/match-equivalence";

type RoomPredictionScore = {
  matchId?: string;
  homeScore: number;
  awayScore: number;
  match: RoomMatchScore;
};

type RoomMatchScore = {
  id?: string;
  competitionId?: string | null;
  roomId?: string | null;
  sourceKey?: string | null;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date | string;
  updatedAt?: Date | string;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  homeScore: number | null;
  awayScore: number | null;
};

export function roomMatchForPrediction<T extends RoomPredictionScore>(
  prediction: T,
  roomMatches: RoomMatchScore[],
  scoredMatches: RoomMatchScore[],
) {
  const roomMatch = roomMatches.find(
    (match) => prediction.matchId === match.id || sameMatchByTeamsAndKickoff(prediction.match, match),
  );

  return roomMatch ?? resolveEffectiveMatchScore(prediction.match, scoredMatches);
}

export function roomPredictionPoints(prediction: Pick<RoomPredictionScore, "homeScore" | "awayScore">, match: RoomMatchScore) {
  if (!hasScoringScore(match)) return 0;

  return calculatePredictionPoints(
    { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
    { homeScore: match.homeScore!, awayScore: match.awayScore! },
  );
}
