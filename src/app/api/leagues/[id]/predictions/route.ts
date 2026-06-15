import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { roomGlobalFallbackMatchWhere, roomOwnedMatchWhere } from "@/lib/room-match-scope";
import { uniqueRoomPredictions } from "@/lib/room-predictions";
import { resolveEffectiveMatchScore, sameMatchByTeamsAndKickoff } from "@/lib/match-equivalence";
import { roomMatchForPrediction, roomPredictionPoints } from "@/lib/room-scoring";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const { id } = await params;
  const league = await prisma.league.findUnique({
    where: { id },
    select: {
      id: true,
      competitionId: true,
      memberships: {
        where: { userId: user!.id },
        select: { id: true },
      },
    },
  });

  if (!league) {
    return Response.json({ error: "Sala no encontrada" }, { status: 404 });
  }
  if (user!.role !== "ADMIN" && league.memberships.length === 0) {
    return Response.json({ error: "No perteneces a esta sala" }, { status: 403 });
  }

  const roomMembers = await prisma.leagueMembership.findMany({
    where: { leagueId: id },
    select: { userId: true, user: { select: { role: true } } },
  });
  const memberIds = roomMembers
    .filter((member) => member.user.role !== "ADMIN")
    .map((member) => member.userId);

  const ownPublishedMatches = await prisma.match.count({
    where: { isPublished: true, ...roomOwnedMatchWhere(league) },
  });
  const matchScope = ownPublishedMatches > 0
    ? roomOwnedMatchWhere(league)
    : roomGlobalFallbackMatchWhere(league);

  const [roomMatches, scoredMatches] = await Promise.all([
    prisma.match.findMany({
      where: {
        isPublished: true,
        ...matchScope,
      },
      select: {
        id: true,
        competitionId: true,
        roomId: true,
        sourceKey: true,
        homeTeam: true,
        awayTeam: true,
        startsAt: true,
        updatedAt: true,
        status: true,
        isPublished: true,
        homeScore: true,
        awayScore: true,
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.match.findMany({
      where: {
        status: { in: ["LIVE", "FINISHED"] },
        homeScore: { not: null },
        awayScore: { not: null },
      },
      select: {
        id: true,
        competitionId: true,
        roomId: true,
        sourceKey: true,
        homeTeam: true,
        awayTeam: true,
        startsAt: true,
        updatedAt: true,
        homeScore: true,
        awayScore: true,
        status: true,
      },
    }),
  ]);

  const now = new Date();
  const liveWindowStart = new Date(now.getTime() - 8 * 60 * 60 * 1000);
  const effectiveRoomMatches = roomMatches.map((match) => resolveEffectiveMatchScore(match, scoredMatches));
  const openMatches = effectiveRoomMatches.filter((match) => match.status !== "FINISHED");
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
  const visiblePredictions = visibleMatches.length
    ? await prisma.prediction.findMany({
        where: {
          userId: { in: memberIds },
          OR: [{ leagueId: id }, { roomKey: id }, { leagueId: null, roomKey: "GLOBAL" }],
        },
        orderBy: [{ match: { startsAt: "asc" } }, { user: { name: "asc" } }],
        select: {
          id: true,
          userId: true,
          matchId: true,
          leagueId: true,
          roomKey: true,
          homeScore: true,
          awayScore: true,
          updatedAt: true,
          user: { select: { id: true, name: true } },
          match: {
            select: {
              id: true,
              homeTeam: true,
              awayTeam: true,
              startsAt: true,
              roomId: true,
              competitionId: true,
              sourceKey: true,
              updatedAt: true,
              status: true,
              isPublished: true,
              homeScore: true,
              awayScore: true,
            },
          },
        },
      })
    : [];
  const scopedVisiblePredictions = visiblePredictions
    .map((prediction) => {
      const match = roomMatchForPrediction(prediction, visibleMatches, scoredMatches);
      const belongsToVisibleMatch = visibleMatches.some(
        (visibleMatch) => match.id === visibleMatch.id || sameMatchByTeamsAndKickoff(match, visibleMatch),
      );

      return belongsToVisibleMatch ? { ...prediction, match } : null;
    })
    .filter((prediction): prediction is NonNullable<typeof prediction> => Boolean(prediction));
  return Response.json({
    matches: visibleMatches,
    predictions: uniqueRoomPredictions(scopedVisiblePredictions, id).map((prediction) => ({
      ...prediction,
      points: roomPredictionPoints(prediction, prediction.match),
    })),
  });
}
