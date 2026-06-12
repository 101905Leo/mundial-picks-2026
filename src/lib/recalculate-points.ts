import { prisma } from "@/lib/prisma";
import { calculatePredictionPoints } from "@/lib/scoring";

export async function recalculateFinishedMatchPoints() {
  const finishedMatches = await prisma.match.findMany({
    where: {
      status: "FINISHED",
      homeScore: { not: null },
      awayScore: { not: null },
    },
    include: { predictions: true },
  });

  let updated = 0;

  for (const match of finishedMatches) {
    await Promise.all(
      match.predictions.map((prediction) => {
        updated += 1;
        return prisma.prediction.update({
          where: { id: prediction.id },
          data: {
            lockedAt: prediction.lockedAt ?? new Date(),
            points:
              prediction.manualPoints ??
              calculatePredictionPoints(
                { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
                { homeScore: match.homeScore!, awayScore: match.awayScore! },
              ),
          },
        });
      }),
    );
  }

  return updated;
}
