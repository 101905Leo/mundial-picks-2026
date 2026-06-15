import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { uniqueRoomPredictions } from "@/lib/room-predictions";
import { resolveEffectiveMatchScore } from "@/lib/match-equivalence";
import { calculatePredictionPoints, getPredictionOutcome } from "@/lib/scoring";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;
  const includeDebug = request.nextUrl.searchParams.get("debug") === "1";

  const { id } = await params;
  const access = await prisma.league.findUnique({
    where: { id },
    select: {
      id: true,
      memberships: {
        where: { userId: user!.id },
        select: { id: true },
      },
    },
  });

  if (!access) {
    return Response.json({ error: "Sala no encontrada" }, { status: 404 });
  }
  if (user!.role !== "ADMIN" && access.memberships.length === 0) {
    return Response.json({ error: "No perteneces a esta sala" }, { status: 403 });
  }

  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      plan: true,
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              createdAt: true,
              role: true,
              isActive: true,
              entryPaidAt: true,
              predictions: {
                select: {
                  id: true,
                  points: true,
                  userId: true,
                  matchId: true,
                  leagueId: true,
                  roomKey: true,
                  homeScore: true,
                  awayScore: true,
                  updatedAt: true,
                  match: {
                    select: {
                      id: true,
                      sourceKey: true,
                      homeTeam: true,
                      awayTeam: true,
                      roomId: true,
                      competitionId: true,
                      isPublished: true,
                      status: true,
                      startsAt: true,
                      updatedAt: true,
                      homeScore: true,
                      awayScore: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!league) {
    return Response.json({ error: "Sala no encontrada" }, { status: 404 });
  }

  const scoredMatches = await prisma.match.findMany({
    where: {
      status: "FINISHED",
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
  });
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const members = league.memberships
    .filter(({ user: member }) => member.role !== "ADMIN")
    .map(({ user: member, role }) => {
      const roomPredictions = member.predictions.filter(
        ({ leagueId, roomKey }) => leagueId === league.id || roomKey === league.id,
      );
      const scopedPredictions = uniqueRoomPredictions(roomPredictions, league.id).map((prediction) => ({
        ...prediction,
        match: resolveEffectiveMatchScore(prediction.match, scoredMatches),
      }));
      const finishedPredictions = scopedPredictions
        .filter(({ match }) => match.status === "FINISHED" && match.homeScore !== null && match.awayScore !== null)
        .sort((a, b) => new Date(b.match.startsAt).getTime() - new Date(a.match.startsAt).getTime());
      let currentStreak = 0;
      for (const prediction of finishedPredictions) {
        const points = calculatePredictionPoints(
          { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
          { homeScore: prediction.match.homeScore!, awayScore: prediction.match.awayScore! },
        );
        if (points >= 2) currentStreak += 1;
        else break;
      }

      return {
        id: member.id,
        name: member.name,
        isActive: member.isActive,
        entryPaidAt: member.entryPaidAt,
        roomRole: role,
        points: finishedPredictions.reduce(
          (sum, prediction) =>
            sum +
            calculatePredictionPoints(
              { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
              { homeScore: prediction.match.homeScore!, awayScore: prediction.match.awayScore! },
            ),
          0,
        ),
        predictions: roomPredictions.length,
        totalPicks: roomPredictions.length,
        scoredPicks: finishedPredictions.length,
        ...(includeDebug
          ? {
              rankingDebug: roomPredictions.map((prediction) => {
                const effectiveMatch = resolveEffectiveMatchScore(prediction.match, scoredMatches);
                const isSelectedForScoring = scopedPredictions.some((scopedPrediction) => scopedPrediction.id === prediction.id);
                const isFinished = effectiveMatch.status === "FINISHED";
                const hasCompleteResult = effectiveMatch.homeScore !== null && effectiveMatch.awayScore !== null;
                const countsForPoints = isSelectedForScoring && isFinished && hasCompleteResult;

                return {
                  predictionId: prediction.id,
                  matchId: prediction.matchId,
                  userId: prediction.userId,
                  roomKey: prediction.roomKey,
                  leagueId: prediction.leagueId,
                  matchRoomId: prediction.match.roomId,
                  matchHomeTeam: prediction.match.homeTeam,
                  matchAwayTeam: prediction.match.awayTeam,
                  pickHomeScore: prediction.homeScore,
                  pickAwayScore: prediction.awayScore,
                  resultHomeScore: effectiveMatch.homeScore,
                  resultAwayScore: effectiveMatch.awayScore,
                  status: effectiveMatch.status,
                  countsForTotalPicks: true,
                  countsForPoints,
                  reason: countsForPoints
                    ? "cuenta para puntos porque pertenece a esta sala y el partido esta FINISHED con marcador completo"
                    : !isSelectedForScoring
                      ? "cuenta como pick guardado, pero no para puntos porque hay otro pick elegido para el mismo partido logico"
                      : !isFinished
                        ? "cuenta como pick guardado, pero no para puntos porque el partido no esta FINISHED"
                        : "cuenta como pick guardado, pero no para puntos porque el partido no tiene resultado completo",
                };
              }),
            }
          : {}),
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
        currentStreak,
        createdAt: member.createdAt,
        weeklyPoints: finishedPredictions
          .filter(({ match }) => match.startsAt >= weekStart)
          .reduce(
            (sum, prediction) =>
              sum +
              calculatePredictionPoints(
                { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
                { homeScore: prediction.match.homeScore!, awayScore: prediction.match.awayScore! },
              ),
            0,
          ),
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.exactScores - a.exactScores ||
        b.winnerCorrect - a.winnerCorrect ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
  const ranking = members;
  const weeklyLeader = [...members].sort((a, b) => b.weeklyPoints - a.weeklyPoints)[0] ?? null;
  const bestActiveStreak = [...members].sort((a, b) => b.currentStreak - a.currentStreak)[0] ?? null;
  const mostExact = [...members].sort((a, b) => b.exactScores - a.exactScores)[0] ?? null;

  return Response.json({
    league: {
      id: league.id,
      name: league.name,
      inviteCode: league.inviteCode,
      ownerId: league.ownerId,
      competitionId: league.competitionId,
      maxParticipants: league.maxParticipants,
      status: league.status,
      expiresAt: league.expiresAt,
      description: league.description,
      rules: league.rules,
      planId: league.planId,
      plan: league.plan,
      paymentStatus: league.paymentStatus,
      paymentAmountInCents: league.paymentAmountInCents,
      paidAt: league.paidAt,
      memberships: league.memberships.map((roomMembership) => ({
        id: roomMembership.id,
        userId: roomMembership.userId,
        role: roomMembership.role,
      })),
    },
    ranking,
    members,
    groupInfo: {
      memberCount: members.length,
      predictionCount: members.reduce((sum, member) => sum + member.predictions, 0),
      weeklyLeader,
      bestActiveStreak,
      mostExact,
    },
  });
}
