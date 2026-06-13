import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { calculatePredictionPoints } from "@/lib/scoring";
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
    match.predictions.map((prediction) =>
      prisma.prediction.update({
        where: { id: prediction.id },
        data: {
          lockedAt: parsed.data.isFinal ? prediction.lockedAt ?? new Date() : prediction.lockedAt,
          points: calculatePredictionPoints(
            { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
            { homeScore: match.homeScore!, awayScore: match.awayScore! },
          ),
          manualPoints: null,
        },
      }),
    ),
  );

  await notifyWhatsAppUsers(
    parsed.data.isFinal
      ? `Resultado final: ${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}. Ya se recalcularon los puntos.`
      : `Marcador parcial: ${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}. Puntos actualizados en vivo.`,
  );

  return Response.json({ match });
}
