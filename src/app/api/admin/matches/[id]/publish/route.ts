import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const publishMatchSchema = z.object({
  publish: z.boolean(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const body = await request.json();
  const parsed = publishMatchSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Accion invalida" }, { status: 400 });
  }

  const { id } = await params;
  const match = await prisma.match.update({
    where: { id },
    data: { isPublished: parsed.data.publish },
  });

  return Response.json({ match });
}
