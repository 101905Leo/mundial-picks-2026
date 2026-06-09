import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { broadcastUrlSchema } from "@/lib/validators";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const body = await request.json();
  const parsed = broadcastUrlSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Enlace invalido" }, { status: 400 });
  }

  const { id } = await params;
  const match = await prisma.match.update({
    where: { id },
    data: { broadcastUrl: parsed.data.broadcastUrl || null },
  });

  return Response.json({ match });
}
