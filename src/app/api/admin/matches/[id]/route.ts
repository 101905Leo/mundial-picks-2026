import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    select: { id: true, homeTeam: true, awayTeam: true },
  });

  if (!match) {
    return Response.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  await prisma.match.delete({ where: { id } });

  return Response.json({ match });
}
