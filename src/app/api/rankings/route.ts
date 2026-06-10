import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  if (user!.role !== "ADMIN" && !user!.entryPaidAt) {
    return Response.json({ error: "Solo usuarios inscritos pueden ver el ranking global" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [{ entryPaidAt: { not: null } }, { role: "ADMIN" }],
    },
    select: {
      id: true,
      name: true,
      predictions: { select: { points: true } },
    },
  });

  const ranking = users
    .map((user) => ({
      id: user.id,
      name: user.name,
      points: user.predictions.reduce((sum, prediction) => sum + prediction.points, 0),
      predictions: user.predictions.length,
    }))
    .sort((a, b) => b.points - a.points || b.predictions - a.predictions);

  return Response.json({ ranking });
}
