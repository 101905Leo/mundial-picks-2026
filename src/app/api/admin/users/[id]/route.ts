import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { normalizeColombianMobilePhone } from "@/lib/validators";

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .transform(normalizeColombianMobilePhone)
    .refine((value) => /^3\d{9}$/.test(value), "Ingresa un celular colombiano valido"),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const parsed = updateUserSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Datos invalidos" }, { status: 400 });
  }

  const { id } = await params;
  const duplicate = await prisma.user.findFirst({
    where: { phone: parsed.data.phone, id: { not: id } },
    select: { id: true },
  });

  if (duplicate) {
    return Response.json({ error: "Ese numero de WhatsApp ya pertenece a otro usuario" }, { status: 409 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, phone: true, role: true, isActive: true, entryPaidAt: true },
  });

  return Response.json({ user });
}

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
