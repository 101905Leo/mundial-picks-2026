import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isPickClosed } from "@/lib/pick-lock";
import { predictionSchema } from "@/lib/validators";
import { matchBelongsToRoomScope } from "@/lib/room-match-scope";

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const body = await request.json();
  const parsed = predictionSchema.safeParse(body);
  const roomId = typeof body.roomId === "string" ? body.roomId : "";

  if (!parsed.success) {
    return Response.json({ error: "Prediccion invalida" }, { status: 400 });
  }

  const match = await prisma.match.findUnique({ where: { id: parsed.data.matchId } });
  if (!match) {
    return Response.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  if (roomId) {
    const roomAccess = await prisma.league.findFirst({
      where: {
        id: roomId,
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        memberships: { some: { userId: user!.id } },
      },
      select: { id: true, competitionId: true },
    });

    const matchBelongsToRoom = roomAccess && matchBelongsToRoomScope(match, roomAccess);

    if (!matchBelongsToRoom) {
      return Response.json({ error: "Este partido no pertenece a tu sala" }, { status: 403 });
    }
  }

  const now = new Date();
  const matchStarted = match.startsAt <= now || match.status === "LIVE" || match.status === "FINISHED";

  if (matchStarted) {
    return Response.json({ error: "El partido ya comenzo. No puedes guardar picks." }, { status: 409 });
  }

  if (isPickClosed(match.startsAt, now)) {
    return Response.json({ error: "La prediccion se cierra 5 minutos antes del partido." }, { status: 409 });
  }

  const hasLeagueAccess =
    user!.role === "ADMIN" ? true : (await prisma.leagueMembership.count({ where: { userId: user!.id } })) > 0;

  if (!user!.isActive && !hasLeagueAccess) {
    return Response.json({ error: "Tu usuario esta desactivado para guardar picks." }, { status: 403 });
  }

  if (user!.role !== "ADMIN" && !roomId) {
    return Response.json({ error: "Debes entrar a una sala para guardar picks." }, { status: 403 });
  }

  const roomKey = roomId || "GLOBAL";
  const prediction = await prisma.prediction.upsert({
    where: { userId_matchId_roomKey: { userId: user!.id, matchId: match.id, roomKey } },
    update: {
      homeScore: parsed.data.homeScore,
      awayScore: parsed.data.awayScore,
      points: 0,
      lockedAt: null,
      leagueId: roomId || null,
    },
    create: {
      userId: user!.id,
      matchId: match.id,
      leagueId: roomId || null,
      roomKey,
      homeScore: parsed.data.homeScore,
      awayScore: parsed.data.awayScore,
    },
  });

  return Response.json({ prediction });
}
