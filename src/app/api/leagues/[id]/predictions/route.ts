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

  const roomMatches = await prisma.match.findMany({
    where: {
      isPublished: true,
      ...roomMatchScopeWhere(membership.league),
    },
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
    orderBy: { startsAt: "asc" },
  });

  const now = new Date();
  const liveWindowStart = new Date(now.getTime() - 8 * 60 * 60 * 1000);
  const openMatches = roomMatches.filter((match) => match.status !== "FINISHED");
  const activeMatches = openMatches.filter((match) => {
    const hasPartialScore = match.homeScore !== null && match.awayScore !== null;
    const looksInPlayByTime = match.startsAt <= now && match.startsAt >= liveWindowStart;
    return match.status === "LIVE" || hasPartialScore || looksInPlayByTime;
  });
  const nearestOpenMatches = [...openMatches].sort(
    (left, right) =>
      Math.abs(left.startsAt.getTime() - now.getTime()) -
      Math.abs(right.startsAt.getTime() - now.getTime()),
  );
  const visibleMatches = activeMatches.length ? activeMatches : nearestOpenMatches.slice(0, 1);
  const visibleMatchIds = visibleMatches.map((match) => match.id);

  const visiblePredictions = visibleMatchIds.length
    ? await prisma.prediction.findMany({
        where: {
          userId: { in: memberIds },
          matchId: { in: visibleMatchIds },
        },
        orderBy: [{ match: { startsAt: "asc" } }, { user: { name: "asc" } }],
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
      })
    : [];

  return Response.json({ matches: visibleMatches, predictions: visiblePredictions });
}
