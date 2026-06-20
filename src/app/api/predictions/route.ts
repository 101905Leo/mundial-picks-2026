import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isPickClosed } from "@/lib/pick-lock";
import { predictionSchema } from "@/lib/validators";
import { sameMatchByTeamsAndKickoff } from "@/lib/match-equivalence";
import { roomOwnedMatchWhere } from "@/lib/room-match-scope";
import { isRoomActivated, ROOM_PENDING_PAYMENT_ERROR, ROOM_PENDING_PAYMENT_STATUS } from "@/lib/room-activation";

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  if (user!.role === "ADMIN") {
    return Response.json(
      { error: "Modo espectador: usa el panel admin para corregir picks de participantes." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = predictionSchema.safeParse(body);
  const incomingLeagueId = typeof body.leagueId === "string" ? body.leagueId : "";
  const incomingRoomKey = typeof body.roomKey === "string" ? body.roomKey : "";
  const incomingRoomId = typeof body.roomId === "string" ? body.roomId : "";
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
      memberships: { some: { userId: user!.id } },
    },
    select: { id: true, competitionId: true, paidAt: true, paymentStatus: true },
  });

  if (!roomAccess) {
    return Response.json({ error: "No tienes acceso a esta sala" }, { status: 403 });
  }
  if (!isRoomActivated(roomAccess)) {
    return Response.json({ error: ROOM_PENDING_PAYMENT_ERROR }, { status: ROOM_PENDING_PAYMENT_STATUS });
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

  if (matchStarted) {
    return Response.json({ error: "El partido ya comenzo. No puedes guardar picks." }, { status: 409 });
  }

  if (isPickClosed(resolvedMatch.startsAt, now)) {
    return Response.json({ error: "La prediccion se cierra 5 minutos antes del partido." }, { status: 409 });
  }

  const hasLeagueAccess = (await prisma.leagueMembership.count({ where: { userId: user!.id } })) > 0;

  if (!user!.isActive && !hasLeagueAccess) {
    return Response.json({ error: "Tu usuario esta desactivado para guardar picks." }, { status: 403 });
  }

  const roomKey = roomAccess.id;
  const prediction = await prisma.prediction.upsert({
    where: { userId_matchId_roomKey: { userId: user!.id, matchId: resolvedMatch.id, roomKey } },
    update: {
      homeScore: parsed.data.homeScore,
      awayScore: parsed.data.awayScore,
      points: 0,
      lockedAt: null,
      leagueId: roomAccess.id,
    },
    create: {
      userId: user!.id,
      matchId: resolvedMatch.id,
      leagueId: roomAccess.id,
      roomKey,
      homeScore: parsed.data.homeScore,
      awayScore: parsed.data.awayScore,
    },
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("prediction-save-debug", {
      userId: user!.id,
      incomingMatchId: parsed.data.matchId,
      incomingLeagueId: incomingLeagueId || null,
      incomingRoomKey: incomingRoomKey || null,
      resolvedLeagueId: roomAccess.id,
      resolvedRoomKey: roomKey,
      resolvedMatchId: resolvedMatch.id,
      savedPredictionId: prediction.id,
    });
  }

  return Response.json({ prediction });
}
