import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, setAuthCookie, signToken } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Datos de registro invalidos" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { phone: parsed.data.phone },
  });

  if (existingUser) {
    return Response.json({ error: "Ese numero celular ya esta registrado" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      passwordHash: await hashPassword(parsed.data.password),
    },
    select: { id: true, name: true, phone: true, role: true, isActive: true, entryPaidAt: true },
  });

  await setAuthCookie(signToken(user));

  return Response.json({ user }, { status: 201 });
}
