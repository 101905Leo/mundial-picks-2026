import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user: admin, response } = await requireAdmin(request);
  if (response) return response;

  const { id } = await params;

  if (admin!.id === id) {
    return Response.json({ error: "No puedes eliminar tu propio usuario admin" }, { status: 409 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, phone: true, role: true },
  });

  if (!user) {
    return Response.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (user.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return Response.json({ error: "No puedes eliminar el ultimo admin" }, { status: 409 });
    }
  }

  await prisma.user.delete({ where: { id } });

  return Response.json({ user });
}
