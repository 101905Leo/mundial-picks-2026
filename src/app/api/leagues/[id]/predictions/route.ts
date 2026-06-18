import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { roomOwnedMatchWhere } from "@/lib/room-match-scope";
import { uniqueRoomPredictions } from "@/lib/room-predictions";
import { calculatePredictionPoints } from "@/lib/scoring";

type LivePointsMatch = {
  id?: string;
  competitionId?: string | null;
  roomId?: string | null;
  sourceKey?: string | null;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date | string;
  updatedAt?: Date | string;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  homeScore: number | null;
  awayScore: number | null;
};

function livePredictionPoints(prediction: { homeScore: number; awayScore: number }, match: LivePointsMatch) {
  if (match.status !== "LIVE" && match.status !== "FINISHED") return 0;
  if (match.homeScore === null || match.awayScore === null) return 0;

  return calculatePredictionPoints(
    { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
    { homeScore: match.homeScore, awayScore: match.awayScore },
  );
}

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

  const roomMatches = await prisma.match.findMany({
    where: {
      isPublished: true,
      ...roomOwnedMatchWhere(league),
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
  const visiblePredictions = visibleMatches.length
    ? await prisma.prediction.findMany({
        where: {
          userId: { in: memberIds },
          matchId: { in: visibleMatches.map((match) => match.id) },
          OR: [{ leagueId: id }, { roomKey: id }],
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
      const match = visibleMatches.find((visibleMatch) => visibleMatch.id === prediction.matchId) ?? prediction.match;
      const belongsToVisibleMatch = visibleMatches.some((visibleMatch) => match.id === visibleMatch.id);

      return belongsToVisibleMatch ? { ...prediction, match } : null;
    })
    .filter((prediction): prediction is NonNullable<typeof prediction> => Boolean(prediction));
  return Response.json({
    matches: visibleMatches,
    predictions: uniqueRoomPredictions(scopedVisiblePredictions, id).map((prediction) => {
      const points = livePredictionPoints(prediction, prediction.match);

      return {
        ...prediction,
        points,
        debug: {
          predictionId: prediction.id,
          predictionMatchId: prediction.matchId,
          resolvedMatchId: prediction.match.id,
          matchStatus: prediction.match.status,
          realHomeScore: prediction.match.homeScore,
          realAwayScore: prediction.match.awayScore,
          calculatedPoints: points,
        },
      };
    }),
  });
}
