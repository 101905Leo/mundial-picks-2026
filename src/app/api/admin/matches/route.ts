import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { matchSchema } from "@/lib/validators";
import { notifyWhatsAppUsers } from "@/lib/whatsapp";

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const body = await request.json();
  const parsed = matchSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Datos del partido invalidos" }, { status: 400 });
  }

  const match = await prisma.match.create({
    data: {
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
