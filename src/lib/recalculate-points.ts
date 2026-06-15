import { prisma } from "@/lib/prisma";
import { calculatePredictionPoints } from "@/lib/scoring";
import { resolveEffectiveMatchScore, sameMatchByTeamsAndKickoff } from "@/lib/match-equivalence";

export async function recalculateFinishedMatchPoints(options: { clearManualPoints?: boolean } = {}) {
  const scoreMatches = await prisma.match.findMany({
    where: {
      status: "FINISHED",
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
    if (effectiveMatch.status !== "FINISHED") continue;
    if (effectiveMatch.homeScore === null || effectiveMatch.awayScore === null) continue;

    const calculatedPoints = calculatePredictionPoints(
      { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
      { homeScore: effectiveMatch.homeScore, awayScore: effectiveMatch.awayScore },
    );
    updated += 1;
    await prisma.prediction.update({
      where: { id: prediction.id },
      data: {
        lockedAt: prediction.lockedAt ?? new Date(),
        points: calculatedPoints,
        ...(options.clearManualPoints ? { manualPoints: null } : {}),
      },
    });
  }

  return updated;
}
