import { prisma } from "@/lib/prisma";
import { calculatePredictionPoints } from "@/lib/scoring";
import { resolveEffectiveMatchScore, sameMatchByTeamsAndKickoff } from "@/lib/match-equivalence";

export async function recalculateFinishedMatchPoints(options: { clearManualPoints?: boolean } = {}) {
  const scoreMatches = await prisma.match.findMany({
    where: {
      homeScore: { not: null },
      awayScore: { not: null },
    },
    select: {
      id: true,
      competitionId: true,
      homeTeam: true,
      awayTeam: true,
      startsAt: true,
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
          homeTeam: true,
          awayTeam: true,
          startsAt: true,
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
    if (effectiveMatch.homeScore === null || effectiveMatch.awayScore === null) continue;

    const calculatedPoints = calculatePredictionPoints(
      { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
      { homeScore: effectiveMatch.homeScore, awayScore: effectiveMatch.awayScore },
    );
    updated += 1;
    await prisma.prediction.update({
      where: { id: prediction.id },
      data: {
        lockedAt: effectiveMatch.status === "FINISHED" ? prediction.lockedAt ?? new Date() : prediction.lockedAt,
        points: options.clearManualPoints ? calculatedPoints : prediction.manualPoints ?? calculatedPoints,
        ...(options.clearManualPoints ? { manualPoints: null } : {}),
      },
    });
  }

  return updated;
}
