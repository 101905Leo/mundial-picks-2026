import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isPickClosed } from "@/lib/pick-lock";
import { predictionSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const body = await request.json();
  const parsed = predictionSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Prediccion invalida" }, { status: 400 });
  }

  const match = await prisma.match.findUnique({ where: { id: parsed.data.matchId } });
  if (!match) {
    return Response.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  if (isPickClosed(match.startsAt)) {
    return Response.json({ error: "La prediccion se cierra 5 minutos antes del partido." }, { status: 409 });
  }

  if (!user!.isActive) {
    return Response.json({ error: "Tu usuario esta desactivado para guardar picks." }, { status: 403 });
  }

  if (user!.role !== "ADMIN" && !user!.entryPaidAt) {
    return Response.json({ error: "Debes pagar la inscripción única para guardar picks." }, { status: 402 });
  }

  const prediction = await prisma.prediction.upsert({
    where: { userId_matchId: { userId: user!.id, matchId: match.id } },
    update: {
      homeScore: parsed.data.homeScore,
      awayScore: parsed.data.awayScore,
      points: 0,
      lockedAt: null,
    },
    create: {
      userId: user!.id,
      matchId: match.id,
      homeScore: parsed.data.homeScore,
      awayScore: parsed.data.awayScore,
    },
  });

  return Response.json({ prediction });
}
