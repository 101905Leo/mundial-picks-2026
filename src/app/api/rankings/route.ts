import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { visiblePredictionPoints } from "@/lib/prediction-points";
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
    .map((user) => ({
      id: user.id,
      name: user.name,
      points: user.predictions.reduce(
        (sum, prediction) => sum + visiblePredictionPoints(prediction, prediction.match),
        0,
      ),
      predictions: user.predictions.length,
    }))
    .sort((a, b) => b.points - a.points || b.predictions - a.predictions);

  return Response.json({ ranking });
}
