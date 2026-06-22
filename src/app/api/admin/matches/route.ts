import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { matchSchema } from "@/lib/validators";
import { notifyWhatsAppUsers } from "@/lib/whatsapp";

const adminMatchSchema = matchSchema.extend({
  competitionId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const body = await request.json();
  const parsed = adminMatchSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Datos del partido invalidos" }, { status: 400 });
  }

  const competition = await prisma.competition.findFirst({
    where: { id: parsed.data.competitionId, isActive: true },
    select: { id: true },
  });
  if (!competition) {
    return Response.json({ error: "Liga o torneo base no encontrado" }, { status: 404 });
  }

  const match = await prisma.match.create({
    data: {
      competitionId: competition.id,
      roomId: null,
      homeTeam: parsed.data.homeTeam,
      awayTeam: parsed.data.awayTeam,
      group: parsed.data.group,
      venue: parsed.data.venue,
      broadcastUrl: parsed.data.broadcastUrl || null,
      startsAt: new Date(parsed.data.startsAt),
    },
  });

  await notifyWhatsAppUsers(
    `Nuevo partido en Copa Mundial de la FIFA 2026™: ${match.homeTeam} vs ${match.awayTeam}. Fecha: ${match.startsAt.toLocaleString("es-CO")}.`,
  );

  return Response.json({ match }, { status: 201 });
}
