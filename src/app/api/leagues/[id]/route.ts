import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { leagueSchema } from "@/lib/validators";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const body = await request.json();
  const parsed = leagueSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Nombre de liga invalido" }, { status: 400 });
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
    return Response.json({ error: "Liga no encontrada" }, { status: 404 });
  }

  const canManage = user!.role === "ADMIN" || league.ownerId === user!.id || league.memberships[0]?.role === "ADMIN";
  if (!canManage) {
    return Response.json({ error: "Solo un administrador de sala puede cambiar el nombre" }, { status: 403 });
  }

  const updatedLeague = await prisma.league.update({
    where: { id },
    data: { name: parsed.data.name },
  });

  return Response.json({ league: updatedLeague });
}
