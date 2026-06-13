import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const deletePredictionSchema = z.object({
  userId: z.string().min(1),
  matchId: z.string().min(1),
});

const savePredictionSchema = deletePredictionSchema.extend({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
  points: z.number().int().min(0).max(100),
});

export async function PUT(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const parsed = savePredictionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Pick o puntos invalidos" }, { status: 400 });
  }

  const [user, match] = await Promise.all([
    prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, name: true } }),
    prisma.match.findUnique({
      where: { id: parsed.data.matchId },
      select: { id: true, homeTeam: true, awayTeam: true, startsAt: true, status: true },
    }),
  ]);

  if (!user || !match) {
    return Response.json({ error: "Usuario o partido no encontrado" }, { status: 404 });
  }

  const prediction = await prisma.prediction.upsert({
    where: { userId_matchId: { userId: user.id, matchId: match.id } },
    update: {
      homeScore: parsed.data.homeScore,
      awayScore: parsed.data.awayScore,
      points: parsed.data.points,
      manualPoints: parsed.data.points,
      lockedAt:
        match.status === "FINISHED" || match.startsAt <= new Date()
          ? new Date()
          : null,
    },
    create: {
      userId: user.id,
      matchId: match.id,
      homeScore: parsed.data.homeScore,
      awayScore: parsed.data.awayScore,
      points: parsed.data.points,
      manualPoints: parsed.data.points,
      lockedAt:
        match.status === "FINISHED" || match.startsAt <= new Date()
          ? new Date()
          : null,
    },
  });

  return Response.json({
    prediction,
    user: user.name,
    match: `${match.homeTeam} vs ${match.awayTeam}`,
    override: "El super admin modifico este pick aunque el partido este cerrado.",
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

  const prediction = await prisma.prediction.findUnique({
    where: {
      userId_matchId: {
        userId: parsed.data.userId,
        matchId: parsed.data.matchId,
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
