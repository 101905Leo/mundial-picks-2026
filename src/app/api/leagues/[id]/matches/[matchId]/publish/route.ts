import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const publishRoomMatchSchema = z.object({
  publish: z.boolean(),
});

async function canManageRoom(leagueId: string, userId: string, role: "USER" | "ADMIN") {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      memberships: {
        where: { userId },
        select: { role: true },
      },
    },
  });

  if (!league) return false;
  return role === "ADMIN" || league.ownerId === userId || league.memberships[0]?.role === "ADMIN";
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

  const manageable = await canManageRoom(id, user!.id, user!.role);
  if (!manageable) {
    return Response.json({ error: "No tienes permisos para publicar partidos en esta sala." }, { status: 403 });
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
