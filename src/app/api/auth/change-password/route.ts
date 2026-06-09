import { NextRequest } from "next/server";
import { getSessionFromRequest, hashPassword, setAuthCookie, signToken, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validators";

export async function PATCH(request: NextRequest) {
  const user = await getSessionFromRequest(request);

  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "La nueva contrasena debe tener minimo 8 caracteres" }, { status: 400 });
  }

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, phone: true, role: true, isActive: true, entryPaidAt: true, passwordHash: true },
  });

  if (!fullUser || !(await verifyPassword(parsed.data.currentPassword, fullUser.passwordHash))) {
    return Response.json({ error: "La contrasena actual no es correcta" }, { status: 401 });
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
    select: { id: true, name: true, phone: true, role: true, isActive: true, entryPaidAt: true },
  });

  await setAuthCookie(signToken(updatedUser));

  return Response.json({ user: updatedUser });
}
