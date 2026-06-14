import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { calculatePredictionPoints } from "@/lib/scoring";
import { matchBelongsToRoomScope } from "@/lib/room-match-scope";
import { resolveEffectiveMatchScore } from "@/lib/match-equivalence";

const deletePredictionSchema = z.object({
  userId: z.string().min(1),
  matchId: z.string().min(1),
  leagueId: z.string().optional(),
});

const savePredictionSchema = deletePredictionSchema.extend({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
});

const manualPointsSchema = deletePredictionSchema.extend({
  points: z.number().int().min(0).max(100),
});

export async function PUT(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const parsed = savePredictionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Pick o puntos invalidos" }, { status: 400 });
  }

  const roomId = parsed.data.leagueId || "";
  const [user, match, room, scoredMatches] = await Promise.all([
    prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, name: true, role: true } }),
    prisma.match.findUnique({
      where: { id: parsed.data.matchId },
      select: {
        id: true,
        homeTeam: true,
        awayTeam: true,
        startsAt: true,
        status: true,
        homeScore: true,
        awayScore: true,
        roomId: true,
        competitionId: true,
      },
    }),
    roomId
      ? prisma.league.findUnique({
          where: { id: roomId },
          select: {
            id: true,
            name: true,
            competitionId: true,
            memberships: { where: { userId: parsed.data.userId }, select: { id: true } },
          },
        })
      : Promise.resolve(null),
    prisma.match.findMany({
      where: { homeScore: { not: null }, awayScore: { not: null } },
      select: {
        id: true,
        competitionId: true,
        homeTeam: true,
        awayTeam: true,
        startsAt: true,
        homeScore: true,
        awayScore: true,
        status: true,
      },
    }),
  ]);

  if (!user || !match) {
    return Response.json({ error: "Usuario o partido no encontrado" }, { status: 404 });
  }

  if (user.role === "ADMIN") {
    return Response.json({ error: "Modo espectador: solo puedes modificar picks de participantes." }, { status: 403 });
  }

  if (roomId) {
    if (!room) {
      return Response.json({ error: "Sala no encontrada" }, { status: 404 });
    }
    if (room.memberships.length === 0) {
      return Response.json({ error: "El participante no pertenece a esta sala" }, { status: 403 });
    }
    if (!matchBelongsToRoomScope(match, room)) {
      return Response.json({ error: "Este partido no pertenece a la sala seleccionada" }, { status: 403 });
    }
  }

  const roomKey = roomId || "GLOBAL";
  const effectiveMatch = resolveEffectiveMatchScore(match, scoredMatches);

  const calculatedPoints =
    effectiveMatch.homeScore !== null && effectiveMatch.awayScore !== null
      ? calculatePredictionPoints(
          { homeScore: parsed.data.homeScore, awayScore: parsed.data.awayScore },
          { homeScore: effectiveMatch.homeScore, awayScore: effectiveMatch.awayScore },
        )
      : 0;

  const prediction = await prisma.prediction.upsert({
    where: { userId_matchId_roomKey: { userId: user.id, matchId: match.id, roomKey } },
    update: {
      homeScore: parsed.data.homeScore,
      awayScore: parsed.data.awayScore,
      points: calculatedPoints,
      manualPoints: null,
      leagueId: roomId || null,
      roomKey,
      lockedAt:
        effectiveMatch.status === "FINISHED" || match.startsAt <= new Date()
          ? new Date()
          : null,
    },
    create: {
      userId: user.id,
      matchId: match.id,
      leagueId: roomId || null,
      roomKey,
      homeScore: parsed.data.homeScore,
      awayScore: parsed.data.awayScore,
      points: calculatedPoints,
      lockedAt:
        effectiveMatch.status === "FINISHED" || match.startsAt <= new Date()
          ? new Date()
          : null,
    },
  });

  return Response.json({
    prediction,
    user: user.name,
    match: `${match.homeTeam} vs ${match.awayTeam}`,
    room: room?.name ?? null,
    override: "El super admin modifico este pick aunque el partido este cerrado.",
  });
}

export async function PATCH(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const parsed = manualPointsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Puntos invalidos" }, { status: 400 });
  }

  const roomId = parsed.data.leagueId || "";
  const roomKey = roomId || "GLOBAL";
  const prediction = await prisma.prediction.findUnique({
    where: {
      userId_matchId_roomKey: {
        userId: parsed.data.userId,
        matchId: parsed.data.matchId,
        roomKey,
      },
    },
    include: {
      user: { select: { id: true, name: true, role: true } },
      match: { select: { id: true, homeTeam: true, awayTeam: true, startsAt: true, status: true } },
    },
  });

  if (!prediction) {
    return Response.json({ error: "Primero crea el pick del participante y luego ajusta sus puntos" }, { status: 404 });
  }

  if (prediction.user.role === "ADMIN") {
    return Response.json({ error: "Modo espectador: solo puedes ajustar puntos de participantes." }, { status: 403 });
  }

  const updatedPrediction = await prisma.prediction.update({
    where: { id: prediction.id },
    data: {
      points: parsed.data.points,
      manualPoints: parsed.data.points,
      lockedAt:
        prediction.match.status === "FINISHED" || prediction.match.startsAt <= new Date()
          ? prediction.lockedAt ?? new Date()
          : prediction.lockedAt,
    },
  });

  return Response.json({
    prediction: updatedPrediction,
    user: prediction.user.name,
    match: `${prediction.match.homeTeam} vs ${prediction.match.awayTeam}`,
    override: "El super admin ajusto puntos manuales separados del pick.",
  });
}

export async function DELETE(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const body = await request.json();
  const parsed = deletePredictionSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const roomId = parsed.data.leagueId || "";
  const roomKey = roomId || "GLOBAL";
  const prediction = await prisma.prediction.findUnique({
    where: {
      userId_matchId_roomKey: {
        userId: parsed.data.userId,
        matchId: parsed.data.matchId,
        roomKey,
      },
    },
    include: {
      user: { select: { id: true, name: true, role: true } },
      match: { select: { homeTeam: true, awayTeam: true } },
    },
  });

  if (!prediction) {
    return Response.json({ error: "Pick no encontrado" }, { status: 404 });
  }

  await prisma.prediction.delete({ where: { id: prediction.id } });

  return Response.json({
    deleted: {
      user: prediction.user.name,
      match: `${prediction.match.homeTeam} vs ${prediction.match.awayTeam}`,
    },
  });
}
