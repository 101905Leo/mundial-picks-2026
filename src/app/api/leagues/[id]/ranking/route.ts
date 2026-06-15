import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { hasRankingScore, rankingPredictionPoints } from "@/lib/prediction-points";
import { uniqueRoomPredictions } from "@/lib/room-predictions";
import { resolveEffectiveMatchScore } from "@/lib/match-equivalence";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

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
              role: true,
              isActive: true,
              entryPaidAt: true,
              predictions: {
                select: {
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
      const scoredPredictions = scopedPredictions.filter(({ match }) => hasRankingScore(match));
      const latestScoredPredictions = scoredPredictions
        .sort((a, b) => new Date(b.match.startsAt).getTime() - new Date(a.match.startsAt).getTime());
      let currentStreak = 0;
      for (const prediction of latestScoredPredictions) {
        if (rankingPredictionPoints(prediction, prediction.match) >= 2) currentStreak += 1;
        else break;
      }
      const points = scopedPredictions.reduce(
        (sum, prediction) => sum + rankingPredictionPoints(prediction, prediction.match),
        0,
      );
      const exactScores = scoredPredictions.filter(
        ({ homeScore, awayScore, match }) =>
          homeScore === match.homeScore &&
          awayScore === match.awayScore,
      ).length;

      return {
        id: member.id,
        name: member.name,
        isActive: member.isActive,
        entryPaidAt: member.entryPaidAt,
        roomRole: role,
        points,
        predictions: scopedPredictions.length,
        scoredPredictions: scoredPredictions.length,
        exactScores,
        currentStreak,
        weeklyPoints: scopedPredictions
          .filter(({ match }) => match.startsAt >= weekStart)
          .reduce((sum, prediction) => sum + rankingPredictionPoints(prediction, prediction.match), 0),
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.exactScores - a.exactScores ||
        b.scoredPredictions - a.scoredPredictions,
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
