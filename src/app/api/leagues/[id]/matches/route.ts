import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { roomOwnedMatchWhere } from "@/lib/room-match-scope";
import { rankingPredictionPoints } from "@/lib/prediction-points";
import { pickRoomPrediction } from "@/lib/room-predictions";
import { getScoringStatus } from "@/lib/scoring";

const privateMatchSchema = z.object({
  homeTeam: z.string().trim().min(2).max(80),
  awayTeam: z.string().trim().min(2).max(80),
  startsAt: z.string().min(1),
  group: z.string().trim().max(80).optional(),
  venue: z.string().trim().max(100).optional(),
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const { id } = await params;
  const league = await prisma.league.findFirst({
    where: user!.role === "ADMIN" ? { id } : { id, memberships: { some: { userId: user!.id } } },
    select: {
      id: true,
      ownerId: true,
      competitionId: true,
      memberships: { where: { userId: user!.id }, select: { role: true } },
    },
  });

  if (!league) {
    return Response.json({ error: user!.role === "ADMIN" ? "Sala no encontrada" : "No perteneces a esta sala" }, { status: user!.role === "ADMIN" ? 404 : 403 });
  }

  const includeHidden = request.nextUrl.searchParams.get("includeHidden") === "true";
  const canManageRoom = user!.role === "ADMIN" || league.ownerId === user!.id || league.memberships[0]?.role === "ADMIN";

  const [matches, userPredictions] = await Promise.all([
    prisma.match.findMany({
      where: {
        ...(includeHidden && canManageRoom ? {} : { isPublished: true }),
        ...roomOwnedMatchWhere(league),
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.prediction.findMany({
      where: {
        userId: user!.id,
        match: roomOwnedMatchWhere(league),
        OR: [{ leagueId: league.id }, { roomKey: league.id }],
      },
      select: {
        id: true,
        matchId: true,
        leagueId: true,
        roomKey: true,
        homeScore: true,
        awayScore: true,
        updatedAt: true,
        match: {
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
        },
      },
    }),
  ]);

  return Response.json({
    matches: matches.map((match) => {
      const status = getScoringStatus(match);
      const matchWithScoringStatus = { ...match, status };
      const matchingPredictions = userPredictions.filter(
        (prediction) => prediction.matchId === match.id,
      );
      return {
        ...matchWithScoringStatus,
        predictions: (() => {
          const prediction = pickRoomPrediction(matchingPredictions, league.id);
          return prediction ? [{ ...prediction, points: rankingPredictionPoints(prediction, matchWithScoringStatus) }] : [];
        })(),
      };
    }),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const { id } = await params;
  const league = await getManageableLeague(id, user!.id, user!.role);
  if (!league) {
    return Response.json({ error: "No tienes permisos para crear partidos en esta sala." }, { status: 403 });
  }

  const parsed = privateMatchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Partido invalido" }, { status: 400 });
  }

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return Response.json({ error: "Fecha del partido invalida." }, { status: 400 });
  }

  const match = await prisma.match.create({
    data: {
      homeTeam: parsed.data.homeTeam,
      awayTeam: parsed.data.awayTeam,
      startsAt,
      group: parsed.data.group || "Liga privada",
      venue: parsed.data.venue || null,
      roomId: league.id,
      isPublished: false,
      status: "SCHEDULED",
    },
  });

  return Response.json({ match, message: "Partido privado creado en la sala." }, { status: 201 });
}
