import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, setAuthCookie, signToken } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);
  const inviteCode = String(body.inviteCode ?? "").trim().toUpperCase();

  if (!parsed.success) {
    const error = parsed.error.issues[0]?.message ?? "Datos de registro invalidos";
    return Response.json({ error }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { phone: parsed.data.phone },
  });

  if (existingUser) {
    return Response.json({ error: "Ese numero de WhatsApp ya esta registrado" }, { status: 409 });
  }

  const league = inviteCode ? await prisma.league.findUnique({ where: { inviteCode } }) : null;

  if (inviteCode && !league) {
    return Response.json({ error: "Codigo de sala no encontrado" }, { status: 404 });
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      passwordHash: await hashPassword(parsed.data.password),
      isActive: false,
      ...(league ? { leagues: { create: { leagueId: league.id } } } : {}),
    },
    select: { id: true, name: true, phone: true, role: true, isActive: true, entryPaidAt: true },
  });

  const sessionUser = { ...user, hasLeagueAccess: Boolean(league) };

  await setAuthCookie(signToken(sessionUser));

  return Response.json({ user: sessionUser, joinedLeague: league }, { status: 201 });
}
