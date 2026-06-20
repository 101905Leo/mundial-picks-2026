import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isRoomActivated, ROOM_PENDING_PAYMENT_ERROR, ROOM_PENDING_PAYMENT_STATUS } from "@/lib/room-activation";

const publishRoomMatchSchema = z.object({
  publish: z.boolean(),
});

async function getManageableRoom(leagueId: string, userId: string, role: "USER" | "ADMIN") {
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const { id, matchId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = publishRoomMatchSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Accion invalida." }, { status: 400 });
  }

  const league = await getManageableRoom(id, user!.id, user!.role);
  if (!league) {
    return Response.json({ error: "No tienes permisos para publicar partidos en esta sala." }, { status: 403 });
  }
  if (!isRoomActivated(league)) {
    return Response.json({ error: ROOM_PENDING_PAYMENT_ERROR }, { status: ROOM_PENDING_PAYMENT_STATUS });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, roomId: true },
  });

  if (!match) {
    return Response.json({ error: "Partido no encontrado." }, { status: 404 });
  }

  if (match.roomId !== id) {
    return Response.json(
      { error: "Este partido no pertenece a esta sala. Cargalo primero dentro de la sala." },
      { status: 409 },
    );
  }

  const updatedMatch = await prisma.match.update({
    where: { id: match.id },
    data: { isPublished: parsed.data.publish },
  });

  return Response.json({ match: updatedMatch });
}
