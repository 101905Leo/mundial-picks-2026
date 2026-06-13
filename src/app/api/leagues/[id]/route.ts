import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const updateRoomSchema = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  description: z.string().trim().max(500).optional(),
  rules: z.string().trim().max(3000).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const parsed = updateRoomSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Datos de sala inválidos" }, { status: 400 });
  }

  const { id } = await params;
  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      memberships: {
        where: { userId: user!.id },
        select: { role: true },
      },
    },
  });

  if (!league) {
    return Response.json({ error: "Sala no encontrada" }, { status: 404 });
  }

  const canManage = user!.role === "ADMIN" || league.ownerId === user!.id || league.memberships[0]?.role === "ADMIN";
  if (!canManage) {
    return Response.json({ error: "Solo un administrador de sala puede cambiar el nombre" }, { status: 403 });
  }

  const updatedLeague = await prisma.league.update({
    where: { id },
    data: parsed.data,
  });

  return Response.json({ league: updatedLeague });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const { id } = await params;
  const league = await prisma.league.findUnique({
    where: { id },
    select: { id: true, name: true, ownerId: true },
  });

  if (!league) {
    return Response.json({ error: "Sala no encontrada" }, { status: 404 });
  }
  if (user!.role !== "ADMIN" && league.ownerId !== user!.id) {
    return Response.json({ error: "Solo el creador o el administrador general puede eliminar la sala" }, { status: 403 });
  }

  await prisma.league.delete({ where: { id } });
  return Response.json({ deleted: { id: league.id, name: league.name } });
}
