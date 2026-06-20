import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { sameMatchByTeamsAndKickoff } from "@/lib/match-equivalence";
import { isRoomActivated, ROOM_PENDING_PAYMENT_ERROR, ROOM_PENDING_PAYMENT_STATUS } from "@/lib/room-activation";

const importMatchesSchema = z.object({
  competitionId: z.string().min(1),
});

async function getManageableLeague(leagueId: string, userId: string, role: "USER" | "ADMIN") {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      memberships: {
        where: { userId },
        select: { role: true },
      },
    },
  });

  if (!league) return null;
  const canManage = role === "ADMIN" || league.ownerId === userId || league.memberships[0]?.role === "ADMIN";
  return canManage ? league : null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = importMatchesSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Selecciona un calendario base valido para cargar partidos." }, { status: 400 });
  }

  const league = await getManageableLeague(id, user!.id, user!.role);
  if (!league) {
    return Response.json({ error: "No tienes permisos para cargar partidos en esta sala." }, { status: 403 });
  }
  if (!isRoomActivated(league)) {
    return Response.json({ error: ROOM_PENDING_PAYMENT_ERROR }, { status: ROOM_PENDING_PAYMENT_STATUS });
  }

  const competition = await prisma.competition.findUnique({
    where: { id: parsed.data.competitionId },
    select: { id: true, name: true },
  });

  if (!competition) {
    return Response.json({ error: "Calendario base no encontrado." }, { status: 404 });
  }

  const sourceMatches = await prisma.match.findMany({
    where: { roomId: null, competitionId: competition.id },
    orderBy: { startsAt: "asc" },
  });

  if (!sourceMatches.length) {
    return Response.json({ error: "Este calendario base todavia no tiene partidos cargados." }, { status: 409 });
  }

  const existingRoomMatches = await prisma.match.findMany({
    where: { roomId: league.id },
    select: {
      id: true,
      competitionId: true,
      homeTeam: true,
      awayTeam: true,
      startsAt: true,
    },
  });

  let created = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    await tx.league.update({
      where: { id: league.id },
      data: { competitionId: competition.id },
    });

    for (const match of sourceMatches) {
      const alreadyExists = existingRoomMatches.some((roomMatch) => sameMatchByTeamsAndKickoff(roomMatch, match));

      if (alreadyExists) {
        skipped += 1;
        continue;
      }

      await tx.match.create({
        data: {
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          group: match.group,
          venue: match.venue,
          broadcastUrl: match.broadcastUrl,
          startsAt: match.startsAt,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          status: match.status,
          isPublished: false,
          competitionId: competition.id,
          roomId: league.id,
        },
      });
      created += 1;
    }
  });

  return Response.json({
    ok: true,
    competition,
    created,
    skipped,
    message: `${created} partido(s) cargado(s) en la sala. ${skipped} ya existian.`,
  });
}
