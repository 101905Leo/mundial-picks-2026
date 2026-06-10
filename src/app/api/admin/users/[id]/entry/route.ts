import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const { id } = await params;
  const user = await prisma.user.update({
    where: { id },
    data: { entryPaidAt: new Date(), isActive: true },
    select: { id: true, name: true, phone: true, role: true, isActive: true, entryPaidAt: true },
  });

  return Response.json({ user });
}
