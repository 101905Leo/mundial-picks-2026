import { prisma } from "@/lib/prisma";
import { resolveEffectiveMatchScore, sameMatchByTeamsAndKickoff } from "@/lib/match-equivalence";
import { hasRankingScore, rankingPredictionPoints } from "@/lib/prediction-points";

export async function recalculateFinishedMatchPoints(options: { clearManualPoints?: boolean } = {}) {
  const scoreMatches = await prisma.match.findMany({
    where: {
      status: { in: ["LIVE", "FINISHED"] },
      homeScore: { not: null },
      awayScore: { not: null },
    },
    select: {
      id: true,
      competitionId: true,
      roomId: true,
      sourceKey: true,
      homeTeam: true,
      awayTeam: true,
      startsAt: true,
      updatedAt: true,
      homeScore: true,
      awayScore: true,
      status: true,
    },
  });

  let updated = 0;
  const predictions = await prisma.prediction.findMany({
    include: {
      match: {
        select: {
          id: true,
          competitionId: true,
          roomId: true,
          sourceKey: true,
          homeTeam: true,
          awayTeam: true,
          startsAt: true,
          updatedAt: true,
          homeScore: true,
          awayScore: true,
          status: true,
        },
      },
    },
  });

  for (const prediction of predictions) {
    const hasDirectOrEquivalentScore = scoreMatches.some((match) => sameMatchByTeamsAndKickoff(match, prediction.match));
    if (!hasDirectOrEquivalentScore) continue;

    const effectiveMatch = resolveEffectiveMatchScore(prediction.match, scoreMatches);
    if (!hasRankingScore(effectiveMatch)) continue;

    const calculatedPoints = rankingPredictionPoints(prediction, effectiveMatch);
    updated += 1;
    await prisma.prediction.update({
      where: { id: prediction.id },
      data: {
        lockedAt: effectiveMatch.status === "FINISHED" ? prediction.lockedAt ?? new Date() : prediction.lockedAt,
        points: calculatedPoints,
        ...(options.clearManualPoints ? { manualPoints: null } : {}),
      },
    });
  }

  return updated;
}
