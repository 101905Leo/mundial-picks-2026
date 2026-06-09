import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const publishAllSchema = z.object({
  publish: z.boolean(),
});

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const body = await request.json();
  const parsed = publishAllSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Accion invalida" }, { status: 400 });
  }

  const result = await prisma.match.updateMany({
    data: { isPublished: parsed.data.publish },
  });

  return Response.json({ updated: result.count, publish: parsed.data.publish });
}
