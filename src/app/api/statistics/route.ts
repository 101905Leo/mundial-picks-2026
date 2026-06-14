import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorldCupStatistics } from "@/lib/worldcup-statistics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const roomId = request.nextUrl.searchParams.get("roomId");

    if (!roomId) {
      return Response.json({ error: "Selecciona una sala para consultar estadísticas." }, { status: 400 });
    }

    const { user, response } = await requireUser(request);
    if (response) return response;

    if (user!.role !== "ADMIN") {
      const membership = await prisma.leagueMembership.findFirst({
        where: { leagueId: roomId, userId: user!.id },
        select: { id: true },
      });

      if (!membership) {
        return Response.json({ error: "No tienes acceso a esta sala" }, { status: 403 });
      }
    }

    return Response.json(await getWorldCupStatistics({ roomId }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron cargar las estadisticas";
    return Response.json({ error: message }, { status: 502 });
  }
}
