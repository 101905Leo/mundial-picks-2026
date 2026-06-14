import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { recalculateFinishedMatchPoints } from "@/lib/recalculate-points";
import { calculatePredictionPoints } from "@/lib/scoring";
import { syncRoomResultsFromGlobal } from "@/lib/sync-room-results";
import { resultSchema } from "@/lib/validators";
import { notifyWhatsAppUsers } from "@/lib/whatsapp";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const body = await request.json();
  const parsed = resultSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Resultado invalido" }, { status: 400 });
  }

  const { id } = await params;
  const existingMatch = await prisma.match.findUnique({
    where: { id },
    select: { id: true, isPublished: true },
  });

  if (!existingMatch) {
    return Response.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  if (!existingMatch.isPublished) {
    return Response.json({ error: "Publica el partido antes de actualizar su marcador" }, { status: 409 });
  }

  const match = await prisma.match.update({
    where: { id },
    data: {
      homeScore: parsed.data.homeScore,
      awayScore: parsed.data.awayScore,
      status: parsed.data.isFinal ? "FINISHED" : "LIVE",
    },
    include: { predictions: true },
  });

  await Promise.all(
    match.predictions.map((prediction) => {
      const calculatedPoints = calculatePredictionPoints(
        { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
        { homeScore: match.homeScore!, awayScore: match.awayScore! },
      );

      return prisma.prediction.update({
        where: { id: prediction.id },
        data: {
          lockedAt: parsed.data.isFinal ? prediction.lockedAt ?? new Date() : prediction.lockedAt,
          points: prediction.manualPoints ?? calculatedPoints,
        },
      });
    }),
  );

  const roomMatchesSynced = match.roomId === null ? await syncRoomResultsFromGlobal() : 0;
  const roomPredictionsRecalculated = roomMatchesSynced > 0 ? await recalculateFinishedMatchPoints() : 0;

  await notifyWhatsAppUsers(
    parsed.data.isFinal
      ? `Resultado final: ${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}. Ya se recalcularon los puntos.`
      : `Marcador parcial: ${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}. Puntos actualizados en vivo.`,
  );

  return Response.json({ match, roomMatchesSynced, roomPredictionsRecalculated });
}
