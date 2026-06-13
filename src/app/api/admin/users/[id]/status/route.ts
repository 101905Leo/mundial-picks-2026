import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const statusSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user: admin, response } = await requireAdmin(request);
  if (response) return response;

  const body = await request.json();
  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Estado invalido" }, { status: 400 });
  }

  const { id } = await params;

  if (admin!.id === id && !parsed.data.isActive) {
    return Response.json({ error: "No puedes desactivar tu propio usuario admin" }, { status: 409 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, entryPaidAt: true },
  });

  if (!user) {
    return Response.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (user.role === "ADMIN" && !parsed.data.isActive) {
    const activeAdminCount = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    if (activeAdminCount <= 1) {
      return Response.json({ error: "No puedes desactivar el ultimo admin activo" }, { status: 409 });
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      isActive: parsed.data.isActive,
    },
    select: { id: true, name: true, phone: true, role: true, isActive: true, entryPaidAt: true },
  });

  return Response.json({ user: updatedUser });
}
