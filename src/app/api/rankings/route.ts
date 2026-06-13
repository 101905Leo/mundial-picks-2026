import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { calculatePredictionPoints } from "@/lib/scoring";
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
        where: { match: { isPublished: true } },
        select: {
          points: true,
          manualPoints: true,
          homeScore: true,
          awayScore: true,
          match: { select: { status: true, homeScore: true, awayScore: true } },
        },
      },
    },
  });

  const predictionPoints = (prediction: (typeof users)[number]["predictions"][number]) => {
    if (prediction.manualPoints !== null) return prediction.manualPoints;
    if (
      (prediction.match.status === "LIVE" || prediction.match.status === "FINISHED") &&
      prediction.match.homeScore !== null &&
      prediction.match.awayScore !== null
    ) {
      return calculatePredictionPoints(
        { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
        { homeScore: prediction.match.homeScore, awayScore: prediction.match.awayScore },
      );
    }
    return prediction.points;
  };

  const ranking = users
    .map((user) => ({
      id: user.id,
      name: user.name,
      points: user.predictions.reduce((sum, prediction) => sum + predictionPoints(prediction), 0),
      predictions: user.predictions.length,
    }))
    .sort((a, b) => b.points - a.points || b.predictions - a.predictions);

  return Response.json({ ranking });
}
