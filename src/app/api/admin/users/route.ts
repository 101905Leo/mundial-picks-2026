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
    },
  });

  return Response.json({ users });
}
