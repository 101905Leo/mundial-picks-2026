import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const deletePredictionSchema = z.object({
  userId: z.string().min(1),
  matchId: z.string().min(1),
});

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
