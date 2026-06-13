import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { roomMatchScopeWhere } from "@/lib/room-match-scope";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const { id } = await params;
  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: user!.id, leagueId: id } },
    select: { id: true, league: { select: { id: true, competitionId: true } } },
  });

  if (!membership) {
    return Response.json({ error: "No perteneces a esta sala" }, { status: 403 });
  }

  const roomMembers = await prisma.leagueMembership.findMany({
    where: { leagueId: id },
    select: { userId: true },
  });
  const memberIds = roomMembers.map((member) => member.userId);

  const predictions = await prisma.prediction.findMany({
    where: {
      userId: { in: memberIds },
      match: {
        isPublished: true,
        ...roomMatchScopeWhere(membership.league),
      },
    },
    orderBy: [{ match: { startsAt: "desc" } }, { user: { name: "asc" } }],
    select: {
      id: true,
      homeScore: true,
      awayScore: true,
      points: true,
      user: { select: { id: true, name: true } },
      match: {
        select: {
          id: true,
          homeTeam: true,
          awayTeam: true,
          startsAt: true,
          status: true,
          isPublished: true,
          homeScore: true,
          awayScore: true,
        },
      },
    },
  });

  const now = new Date();
  const liveWindowStart = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const visiblePredictions = predictions.filter(({ match }) => {
    const looksInPlayByTime = match.startsAt <= now && match.startsAt >= liveWindowStart;
    return match.isPublished && (match.status === "LIVE" || (looksInPlayByTime && match.status !== "FINISHED"));
  });

  return Response.json({ predictions: visiblePredictions });
}
