import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { roomOwnedMatchWhere } from "@/lib/room-match-scope";
import { pickRoomPrediction, uniqueRoomPredictions } from "@/lib/room-predictions";
import { getScoringStatus, calculatePredictionPoints } from "@/lib/scoring";

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
  const scoringStatus = getScoringStatus(match);
  if (scoringStatus !== "LIVE" && scoringStatus !== "FINISHED") return 0;
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
    select: { userId: true, user: { select: { id: true, name: true, role: true } } },
  });
  const participantMembers = roomMembers
    .filter((member) => member.user.role !== "ADMIN")
    .map((member) => member.user);
  const memberIds = participantMembers.map((member) => member.id);

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
  const matchesWithScoringStatus = roomMatches.map((match) => ({
    ...match,
    status: getScoringStatus(match, now),
  }));
  const openMatches = matchesWithScoringStatus.filter((match) => match.status !== "FINISHED");
  const liveMatches = matchesWithScoringStatus.filter((match) => match.status === "LIVE");
  const lastFinishedMatch = [...matchesWithScoringStatus]
    .filter((match) => match.status === "FINISHED")
    .sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime())[0];
  const nearestOpenMatches = [...openMatches].sort(
    (left, right) =>
      Math.abs(left.startsAt.getTime() - now.getTime()) -
      Math.abs(right.startsAt.getTime() - now.getTime()),
  );
  const visibleMatches = liveMatches.length ? liveMatches : nearestOpenMatches.slice(0, 1);
  if (!visibleMatches.length && lastFinishedMatch) {
    visibleMatches.push(lastFinishedMatch);
  }
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
  const uniqueVisiblePredictions = uniqueRoomPredictions(scopedVisiblePredictions, id);
  const predictionsByMemberAndMatch = new Map<string, (typeof uniqueVisiblePredictions)[number]>();
  for (const prediction of uniqueVisiblePredictions) {
    predictionsByMemberAndMatch.set(`${prediction.userId}:${prediction.match.id}`, prediction);
  }
  return Response.json({
    matches: visibleMatches,
    predictions: visibleMatches.flatMap((match) => {
      const matchStatus = getScoringStatus(match, now);
      if (matchStatus === "SCHEDULED") return [];

      return participantMembers.map((member) => {
        const prediction = pickRoomPrediction(
          uniqueVisiblePredictions.filter((item) => item.userId === member.id && item.match.id === match.id),
          id,
        ) ?? predictionsByMemberAndMatch.get(`${member.id}:${match.id}`) ?? null;
        const points = prediction ? livePredictionPoints(prediction, match) : 0;

        return {
          id: prediction?.id ?? `missing-${member.id}-${match.id}`,
          predictionId: prediction?.id ?? null,
          userId: member.id,
          matchId: match.id,
          leagueId: prediction?.leagueId ?? id,
          roomKey: prediction?.roomKey ?? id,
          homeScore: prediction?.homeScore ?? null,
          awayScore: prediction?.awayScore ?? null,
          updatedAt: prediction?.updatedAt ?? null,
          user: { id: member.id, name: member.name },
          match: {
            ...match,
            status: matchStatus,
          },
          points,
          debug: {
            predictionId: prediction?.id ?? null,
            predictionMatchId: prediction?.matchId ?? null,
            resolvedMatchId: match.id,
            matchStatus,
            realHomeScore: match.homeScore,
            realAwayScore: match.awayScore,
            calculatedPoints: points,
          },
        };
      });
    }),
  });
}
