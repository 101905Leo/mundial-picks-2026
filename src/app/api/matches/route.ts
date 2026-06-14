import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { visiblePredictionPoints } from "@/lib/prediction-points";

export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request);
  const includeHidden = request.nextUrl.searchParams.get("includeHidden") === "true" && user?.role === "ADMIN";
  const includeRoomMatches = request.nextUrl.searchParams.get("includeRooms") === "true" && user?.role === "ADMIN";

  const matches = await prisma.match.findMany({
    where: includeHidden
      ? includeRoomMatches
        ? {}
        : { roomId: null }
      : { isPublished: true, roomId: null },
    orderBy: { startsAt: "asc" },
    include: {
      predictions: user
        ? {
            where: { userId: user.id, roomKey: "GLOBAL" },
            select: { id: true, homeScore: true, awayScore: true, points: true, manualPoints: true },
          }
        : false,
    },
  });

  return Response.json({
    matches: matches.map((match) => ({
      ...match,
      predictions: Array.isArray(match.predictions)
        ? match.predictions.map((prediction) => ({
            ...prediction,
            points: visiblePredictionPoints(prediction, match),
          }))
        : match.predictions,
    })),
  });
}
