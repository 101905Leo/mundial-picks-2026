import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { adminResetPasswordSchema } from "@/lib/validators";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const body = await request.json();
  const parsed = adminResetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    const error = parsed.error.issues[0]?.message ?? "PIN invalido";
    return Response.json({ error }, { status: 400 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, phone: true },
  });

  if (!user) {
    return Response.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });

  return Response.json({ user });
}
