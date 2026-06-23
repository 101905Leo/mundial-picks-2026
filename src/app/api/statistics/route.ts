import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorldCupStatistics } from "@/lib/worldcup-statistics";
import { isRoomActivated, ROOM_PENDING_PAYMENT_ERROR, ROOM_PENDING_PAYMENT_STATUS } from "@/lib/room-activation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const roomId = request.nextUrl.searchParams.get("roomId");

    if (!roomId) {
      return Response.json({ error: "Selecciona una sala para consultar estadísticas." }, { status: 400 });
    }

    const { user, response } = await requireUser(request);
    if (response) return response;

    const league = await prisma.league.findUnique({
      where: { id: roomId },
      select: {
        status: true,
        expiresAt: true,
        paidAt: true,
        paymentStatus: true,
        memberships: {
          where: { userId: user!.id, user: { isActive: true } },
          select: { id: true },
        },
      },
    });

    if (!league) {
      return Response.json({ error: "Sala no encontrada" }, { status: 404 });
    }

    if (user!.role !== "ADMIN" && league.memberships.length === 0) {
      return Response.json({ error: "No tienes acceso a esta sala" }, { status: 403 });
    }

    if (!isRoomActivated(league)) {
      return Response.json({ error: ROOM_PENDING_PAYMENT_ERROR }, { status: ROOM_PENDING_PAYMENT_STATUS });
    }

    if (league.status !== "ACTIVE" || (league.expiresAt && league.expiresAt <= new Date())) {
      return Response.json({ error: "Esta sala está vencida, suspendida o cerrada" }, { status: 403 });
    }

    return Response.json(await getWorldCupStatistics({ roomId }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron cargar las estadisticas";
    return Response.json({ error: message }, { status: 502 });
  }
}
