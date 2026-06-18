import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isPickClosed } from "@/lib/pick-lock";
import { predictionSchema } from "@/lib/validators";
import { sameMatchByTeamsAndKickoff } from "@/lib/match-equivalence";
import { roomOwnedMatchWhere } from "@/lib/room-match-scope";

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const body = await request.json();
  const parsed = predictionSchema.safeParse(body);
  const incomingLeagueId = typeof body.leagueId === "string" ? body.leagueId : "";
  const incomingRoomKey = typeof body.roomKey === "string" ? body.roomKey : "";
  const incomingRoomId = typeof body.roomId === "string" ? body.roomId : "";
  const requestedUserId =
    typeof body.targetUserId === "string"
      ? body.targetUserId
      : typeof body.participantUserId === "string"
        ? body.participantUserId
        : user!.id;
  const roomId = incomingRoomId || incomingLeagueId || (incomingRoomKey && incomingRoomKey !== "GLOBAL" ? incomingRoomKey : "");

  if (!parsed.success) {
    return Response.json({ error: "Prediccion invalida" }, { status: 400 });
  }

  const incomingMatch = await prisma.match.findUnique({ where: { id: parsed.data.matchId } });
  if (!incomingMatch) {
    return Response.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  if (!roomId) {
    return Response.json({ error: "Debes entrar a una sala para guardar picks." }, { status: 403 });
  }

  const roomAccess = await prisma.league.findFirst({
    where: {
      id: roomId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      ...(user!.role === "ADMIN" ? {} : { memberships: { some: { userId: user!.id } } }),
    },
    select: {
      id: true,
      ownerId: true,
      competitionId: true,
      memberships: { where: { userId: user!.id }, select: { role: true } },
    },
  });

  if (!roomAccess) {
    return Response.json({ error: "No tienes acceso a esta sala" }, { status: 403 });
  }

  const isSuperAdmin = user!.role === "ADMIN";
  const isRoomOwner = roomAccess.ownerId === user!.id;
  const isRoomAdmin = roomAccess.memberships[0]?.role === "ADMIN";
  const isAdministrativeSave = requestedUserId !== user!.id;

  if (isAdministrativeSave && !isSuperAdmin && !isRoomOwner && !isRoomAdmin) {
    return Response.json({ error: "No puedes guardar picks de otro participante." }, { status: 403 });
  }

  const targetMembership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: requestedUserId, leagueId: roomAccess.id } },
    select: { userId: true, user: { select: { role: true } } },
  });

  if (!targetMembership || targetMembership.user.role === "ADMIN") {
    return Response.json({ error: "El participante no pertenece a esta sala." }, { status: 403 });
  }

  const roomMatches = await prisma.match.findMany({
    where: roomOwnedMatchWhere(roomAccess),
    select: {
      id: true,
      roomId: true,
      competitionId: true,
      homeTeam: true,
      awayTeam: true,
      startsAt: true,
    },
  });

  const roomOwnedEquivalent = roomMatches.find(
    (candidate) =>
      candidate.roomId === roomAccess.id &&
      (candidate.id === incomingMatch.id || sameMatchByTeamsAndKickoff(candidate, incomingMatch)),
  );

  if (!roomOwnedEquivalent) {
    return Response.json({ error: "Este partido no pertenece a tu sala" }, { status: 403 });
  }

  const resolvedMatch =
    roomOwnedEquivalent && roomOwnedEquivalent.id !== incomingMatch.id
      ? await prisma.match.findUnique({ where: { id: roomOwnedEquivalent.id } })
      : incomingMatch;

  if (!resolvedMatch) {
    return Response.json({ error: "Partido de sala no encontrado" }, { status: 404 });
  }

  const now = new Date();
  const matchStarted =
    resolvedMatch.startsAt <= now || resolvedMatch.status === "LIVE" || resolvedMatch.status === "FINISHED";

  if (matchStarted && !isSuperAdmin) {
    return Response.json({ error: "El partido ya comenzo. No puedes guardar picks." }, { status: 409 });
  }

  if (isPickClosed(resolvedMatch.startsAt, now) && !isSuperAdmin) {
    return Response.json({ error: "La prediccion se cierra 5 minutos antes del partido." }, { status: 409 });
  }

  const hasLeagueAccess = (await prisma.leagueMembership.count({ where: { userId: requestedUserId } })) > 0;

  if (!isSuperAdmin && !user!.isActive && !hasLeagueAccess) {
    return Response.json({ error: "Tu usuario esta desactivado para guardar picks." }, { status: 403 });
  }

  const roomKey = roomAccess.id;
  const prediction = await prisma.prediction.upsert({
    where: { userId_matchId_roomKey: { userId: requestedUserId, matchId: resolvedMatch.id, roomKey } },
    update: {
      homeScore: parsed.data.homeScore,
      awayScore: parsed.data.awayScore,
      points: 0,
      lockedAt: null,
      leagueId: roomAccess.id,
    },
    create: {
      userId: requestedUserId,
      matchId: resolvedMatch.id,
      leagueId: roomAccess.id,
      roomKey,
      homeScore: parsed.data.homeScore,
      awayScore: parsed.data.awayScore,
    },
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("prediction-save-debug", {
      userId: requestedUserId,
      savedByUserId: user!.id,
      isAdministrativeSave,
      incomingMatchId: parsed.data.matchId,
      incomingLeagueId: incomingLeagueId || null,
      incomingRoomKey: incomingRoomKey || null,
      resolvedLeagueId: roomAccess.id,
      resolvedRoomKey: roomKey,
      resolvedMatchId: resolvedMatch.id,
      savedPredictionId: prediction.id,
    });
  }

  return Response.json({
    ok: true,
    prediction,
    savedForUserId: requestedUserId,
    savedByUserId: user!.id,
    isAdministrativeSave,
  });
}
