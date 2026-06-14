import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { roomGlobalFallbackMatchWhere, roomOwnedMatchWhere } from "@/lib/room-match-scope";
import { visiblePredictionPoints } from "@/lib/prediction-points";
import { pickRoomPrediction } from "@/lib/room-predictions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const { id } = await params;
  const league = await prisma.league.findFirst({
    where: user!.role === "ADMIN" ? { id } : { id, memberships: { some: { userId: user!.id } } },
    select: { id: true, competitionId: true },
  });

  if (!league) {
    return Response.json({ error: user!.role === "ADMIN" ? "Sala no encontrada" : "No perteneces a esta sala" }, { status: user!.role === "ADMIN" ? 404 : 403 });
  }

  const ownPublishedMatches = await prisma.match.count({
    where: { isPublished: true, ...roomOwnedMatchWhere(league) },
  });
  const matchScope = ownPublishedMatches > 0 ? roomOwnedMatchWhere(league) : roomGlobalFallbackMatchWhere(league);

  const matches = await prisma.match.findMany({
    where: {
      isPublished: true,
      ...matchScope,
    },
    orderBy: { startsAt: "asc" },
    include: {
      predictions: {
        where: {
          userId: user!.id,
          OR: [{ leagueId: league.id }, { leagueId: null, roomKey: "GLOBAL" }],
        },
        select: {
          id: true,
          matchId: true,
          leagueId: true,
          roomKey: true,
          homeScore: true,
          awayScore: true,
          points: true,
          manualPoints: true,
        },
      },
    },
  });

  return Response.json({
    matches: matches.map((match) => ({
      ...match,
      predictions: (() => {
        const prediction = pickRoomPrediction(match.predictions, league.id);
        return prediction ? [{ ...prediction, points: visiblePredictionPoints(prediction, match) }] : [];
      })(),
    })),
  });
}
