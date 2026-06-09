import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, signToken, verifyPassword } from "@/lib/auth";
import { credentialsSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = credentialsSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Credenciales invalidas" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { phone: parsed.data.phone },
  });

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return Response.json({ error: "Celular o contrasena incorrectos" }, { status: 401 });
  }

  if (!user.isActive) {
    return Response.json({ error: "Tu usuario esta desactivado. Contacta al administrador." }, { status: 403 });
  }

  const sessionUser = {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    entryPaidAt: user.entryPaidAt,
  };

  await setAuthCookie(signToken(sessionUser));

  return Response.json({ user: sessionUser });
}
