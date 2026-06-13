import { prisma } from "@/lib/prisma";
import { calculatePredictionPoints } from "@/lib/scoring";

export async function recalculateFinishedMatchPoints() {
  const scoreMatches = await prisma.match.findMany({
    where: {
      status: { in: ["LIVE", "FINISHED"] },
      homeScore: { not: null },
      awayScore: { not: null },
    },
    include: { predictions: true },
  });

  let updated = 0;

  for (const match of scoreMatches) {
    await Promise.all(
      match.predictions.map((prediction) => {
        const calculatedPoints = calculatePredictionPoints(
          { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
          { homeScore: match.homeScore!, awayScore: match.awayScore! },
        );
        updated += 1;
        return prisma.prediction.update({
          where: { id: prediction.id },
          data: {
            lockedAt: match.status === "FINISHED" ? prediction.lockedAt ?? new Date() : prediction.lockedAt,
            points: prediction.manualPoints ?? calculatedPoints,
          },
        });
      }),
    );
  }

  return updated;
}
