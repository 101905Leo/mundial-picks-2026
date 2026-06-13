import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const { id, userId } = await params;
  const league = await prisma.league.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!league) {
    return Response.json({ error: "Sala no encontrada" }, { status: 404 });
  }

  if (league.ownerId !== user!.id) {
    return Response.json({ error: "Solo el creador puede administrar integrantes" }, { status: 403 });
  }

  if (userId === league.ownerId) {
    return Response.json({ error: "El creador no puede retirarse de su propia sala" }, { status: 400 });
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId: id } },
    include: { user: { select: { name: true } } },
  });

  if (!membership) {
    return Response.json({ error: "El usuario no pertenece a esta sala" }, { status: 404 });
  }

  await prisma.leagueMembership.delete({ where: { id: membership.id } });
  return Response.json({ removed: { id: userId, name: membership.user.name } });
}
