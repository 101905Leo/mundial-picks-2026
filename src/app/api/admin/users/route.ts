import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
      entryPaidAt: true,
      predictions: {
        select: {
          points: true,
        },
      },
      _count: {
        select: {
          predictions: true,
        },
      },
    },
  });

  return Response.json({
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      entryPaidAt: user.entryPaidAt,
      picksCount: user._count.predictions,
      points: user.predictions.reduce((sum, prediction) => sum + prediction.points, 0),
    })),
  });
}
