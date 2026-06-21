import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, setAuthCookie, signToken } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);
  const inviteCode = parsed.success ? (parsed.data.inviteCode ?? "").trim().toUpperCase() : "";

  if (!parsed.success) {
    const error = parsed.error.issues[0]?.message ?? "Datos de registro invalidos";
    return Response.json({ error }, { status: 400 });
  }

  if (!inviteCode) {
    return Response.json({ error: "Necesitas el codigo de sala para registrarte" }, { status: 400 });
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

  if (league) {
    if (!league.paidAt || !["APPROVED", "TRIAL", "MANUAL"].includes(league.paymentStatus)) {
      return Response.json({ error: "La sala todavía no ha confirmado el pago de su cupo" }, { status: 403 });
    }
    if (league.status !== "ACTIVE" || (league.expiresAt && league.expiresAt <= new Date())) {
      return Response.json({ error: "La sala está vencida, suspendida o cerrada" }, { status: 403 });
    }
    const participants = await prisma.leagueMembership.count({ where: { leagueId: league.id } });
    if (participants >= league.maxParticipants) {
      return Response.json({ error: "Esta sala ya completo su cupo de participantes" }, { status: 409 });
    }
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
