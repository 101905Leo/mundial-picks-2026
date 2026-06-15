import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { hasRankingScore, rankingPredictionPoints } from "@/lib/prediction-points";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const users = await prisma.user.findMany({
    where: {
      role: "USER",
    },
    select: {
      id: true,
      name: true,
      predictions: {
        where: { roomKey: "GLOBAL", match: { isPublished: true } },
        select: {
          homeScore: true,
          awayScore: true,
          updatedAt: true,
          match: { select: { status: true, homeScore: true, awayScore: true, updatedAt: true } },
        },
      },
    },
  });

  const ranking = users
    .map((user) => {
      const scoredPredictions = user.predictions.filter((prediction) => hasRankingScore(prediction.match));

      return {
        id: user.id,
        name: user.name,
        points: user.predictions.reduce(
          (sum, prediction) => sum + rankingPredictionPoints(prediction, prediction.match),
          0,
        ),
        predictions: user.predictions.length,
        scoredPredictions: scoredPredictions.length,
      };
    })
    .sort((a, b) => b.points - a.points || b.scoredPredictions - a.scoredPredictions)
    .map(({ scoredPredictions: _scoredPredictions, ...item }) => item);

  return Response.json({ ranking });
}
