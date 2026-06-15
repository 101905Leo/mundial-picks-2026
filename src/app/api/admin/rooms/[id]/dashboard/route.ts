import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  roomGlobalFallbackMatchWhere,
  roomMatchScopeWhere,
  roomOwnedMatchWhere,
} from "@/lib/room-match-scope";
import { hasRankingScore, rankingPredictionPoints } from "@/lib/prediction-points";
import { uniqueRoomPredictions } from "@/lib/room-predictions";
import { resolveEffectiveMatchScore, sameMatchByTeamsAndKickoff } from "@/lib/match-equivalence";
import { removeSuperAdminRoomMemberships } from "@/lib/remove-super-admin-room-memberships";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const { id } = await params;
  await removeSuperAdminRoomMemberships();

  const room = await prisma.league.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, phone: true } },
      competition: { select: { id: true, name: true, season: true, country: true } },
      plan: { select: { id: true, name: true, slug: true, participantLimit: true, durationDays: true, priceInCents: true } },
      memberships: {
        orderBy: { joinedAt: "asc" },
        include: {
          user: { select: { id: true, name: true, phone: true, isActive: true, entryPaidAt: true, role: true } },
        },
      },
    },
  });

  if (!room) {
    return Response.json({ error: "Sala no encontrada" }, { status: 404 });
  }

  const ownPublishedMatches = await prisma.match.count({
    where: { isPublished: true, ...roomOwnedMatchWhere(room) },
  });
  const ownMatchCount = await prisma.match.count({
    where: roomOwnedMatchWhere(room),
  });
  const matchScope = ownPublishedMatches > 0 ? roomOwnedMatchWhere(room) : roomGlobalFallbackMatchWhere(room);
  const visibleMemberships = room.memberships.filter((membership) => membership.user.role !== "ADMIN");
  const memberIds = visibleMemberships.map((membership) => membership.userId);

  const [matches, rawPredictions, messages, scoredMatches, roomScopeMatches] = await Promise.all([
    prisma.match.findMany({
      where: { isPublished: true, ...matchScope },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        homeTeam: true,
        awayTeam: true,
        group: true,
        venue: true,
        startsAt: true,
        homeScore: true,
        awayScore: true,
        status: true,
        isPublished: true,
        roomId: true,
        competitionId: true,
      },
    }),
    prisma.prediction.findMany({
      where: {
        userId: { in: memberIds },
        OR: [{ leagueId: room.id }, { roomKey: room.id }, { leagueId: null, roomKey: "GLOBAL" }],
      },
      orderBy: [{ match: { startsAt: "asc" } }, { user: { name: "asc" } }],
      include: {
        user: { select: { id: true, name: true, phone: true } },
        match: {
          select: {
            id: true,
            sourceKey: true,
            homeTeam: true,
            awayTeam: true,
            startsAt: true,
            updatedAt: true,
            homeScore: true,
            awayScore: true,
            status: true,
            isPublished: true,
            roomId: true,
            competitionId: true,
          },
        },
      },
    }),
    prisma.leagueMessage.findMany({
      where: { leagueId: room.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { id: true, name: true, phone: true, role: true } } },
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
    prisma.match.findMany({
      where: roomMatchScopeWhere(room),
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

  const scopedPredictions = uniqueRoomPredictions(
    rawPredictions.filter((prediction) => {
      if (prediction.leagueId === room.id || prediction.roomKey === room.id) return true;
      if (prediction.leagueId !== null || prediction.roomKey !== "GLOBAL") return false;

      return roomScopeMatches.some((candidate) => {
        const candidateBelongsToRoom = candidate.roomId === room.id;
        const candidateIsAllowedGlobal = ownMatchCount === 0 && candidate.roomId === null;

        return (
          (candidateBelongsToRoom || candidateIsAllowedGlobal) &&
          sameMatchByTeamsAndKickoff(candidate, prediction.match)
        );
      });
    }),
    room.id,
  ).map((prediction) => ({
    ...prediction,
    match: resolveEffectiveMatchScore(prediction.match, scoredMatches),
    points: rankingPredictionPoints(prediction, resolveEffectiveMatchScore(prediction.match, scoredMatches)),
  }));
  const effectiveMatches = matches.map((match) => resolveEffectiveMatchScore(match, scoredMatches));

  const ranking = visibleMemberships
    .map((membership) => {
      const userPredictions = scopedPredictions.filter((prediction) => prediction.userId === membership.userId);
      const scoredPredictions = userPredictions.filter((prediction) => hasRankingScore(prediction.match));
      const exactScores = scoredPredictions.filter(
        (prediction) =>
          prediction.match.homeScore === prediction.homeScore &&
          prediction.match.awayScore === prediction.awayScore,
      ).length;

      return {
        id: membership.user.id,
        name: membership.user.name,
        phone: membership.user.phone,
        isActive: membership.user.isActive,
        entryPaidAt: membership.user.entryPaidAt,
        roomRole: membership.role,
        predictions: userPredictions.length,
        points: userPredictions.reduce((sum, prediction) => sum + prediction.points, 0),
        scoredPredictions: scoredPredictions.length,
        exactScores,
      };
    })
    .sort(
      (left, right) =>
        right.points - left.points ||
        right.exactScores - left.exactScores ||
        right.scoredPredictions - left.scoredPredictions,
    );

  return Response.json({
    room,
    summary: {
      participants: visibleMemberships.length,
      admins: visibleMemberships.filter((membership) => membership.role === "ADMIN").length,
      matches: effectiveMatches.length,
      picks: scopedPredictions.length,
      messages: messages.length,
      finishedMatches: effectiveMatches.filter((match) => match.status === "FINISHED").length,
      liveMatches: effectiveMatches.filter((match) => match.status === "LIVE").length,
    },
    participants: visibleMemberships.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      phone: membership.user.phone,
      isActive: membership.user.isActive,
      entryPaidAt: membership.user.entryPaidAt,
      role: membership.role,
      joinedAt: membership.joinedAt,
    })),
    ranking,
    matches: effectiveMatches,
    predictions: scopedPredictions,
    messages: messages.reverse(),
  });
}
