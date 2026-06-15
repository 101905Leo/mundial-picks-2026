import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { visiblePredictionPoints } from "@/lib/prediction-points";
import { getPredictionOutcome } from "@/lib/scoring";
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
      createdAt: true,
      predictions: {
        where: { roomKey: "GLOBAL", match: { isPublished: true } },
        select: {
          points: true,
          manualPoints: true,
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
      const finishedPredictions = user.predictions.filter(
        ({ match }) => match.homeScore !== null && match.awayScore !== null,
      );

      return {
        id: user.id,
        name: user.name,
        points: finishedPredictions.reduce(
          (sum, prediction) => sum + visiblePredictionPoints(prediction, prediction.match),
          0,
        ),
        predictions: user.predictions.length,
        exactScores: finishedPredictions.filter(
          ({ homeScore, awayScore, match }) =>
            getPredictionOutcome(
              { homeScore, awayScore },
              { homeScore: match.homeScore!, awayScore: match.awayScore! },
            ) === "EXACT",
        ).length,
        winnerCorrect: finishedPredictions.filter(
          ({ homeScore, awayScore, match }) =>
            getPredictionOutcome(
              { homeScore, awayScore },
              { homeScore: match.homeScore!, awayScore: match.awayScore! },
            ) === "WINNER",
        ).length,
        createdAt: user.createdAt,
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.exactScores - a.exactScores ||
        b.winnerCorrect - a.winnerCorrect ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );

  return Response.json({ ranking });
}
