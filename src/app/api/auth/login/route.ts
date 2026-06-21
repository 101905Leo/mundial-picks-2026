import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, signToken, verifyPassword } from "@/lib/auth";
import { credentialsSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = credentialsSchema.safeParse(body);
  const inviteCode = String(body.inviteCode ?? "").trim().toUpperCase();

  if (!parsed.success) {
    const error = parsed.error.issues[0]?.message ?? "Credenciales invalidas";
    return Response.json({ error }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { phone: parsed.data.phone },
  });

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return Response.json({ error: "Celular o PIN incorrectos" }, { status: 401 });
  }

  let joinedLeague = null;

  if (inviteCode) {
    const league = await prisma.league.findUnique({ where: { inviteCode } });

    if (!league) {
      return Response.json({ error: "Codigo de sala no encontrado" }, { status: 404 });
    }

    if (user.role === "ADMIN") {
      joinedLeague = league;
    } else {
      if (!league.paidAt || !["APPROVED", "TRIAL", "MANUAL"].includes(league.paymentStatus)) {
        return Response.json({ error: "La sala todavía no ha confirmado el pago de su cupo" }, { status: 403 });
      }
      if (league.status !== "ACTIVE" || (league.expiresAt && league.expiresAt <= new Date())) {
        return Response.json({ error: "La sala está vencida, suspendida o cerrada" }, { status: 403 });
      }

      const existingMembership = await prisma.leagueMembership.findUnique({
        where: { userId_leagueId: { userId: user.id, leagueId: league.id } },
      });
      const participants = await prisma.leagueMembership.count({ where: { leagueId: league.id } });
      if (!existingMembership && participants >= league.maxParticipants) {
        return Response.json({ error: "Esta sala ya completo su cupo de participantes" }, { status: 409 });
      }

      await prisma.leagueMembership.upsert({
        where: { userId_leagueId: { userId: user.id, leagueId: league.id } },
        update: {},
        create: { userId: user.id, leagueId: league.id },
      });

      joinedLeague = league;
    }
  }

  const leagueCount = await prisma.leagueMembership.count({ where: { userId: user.id } });
  const sessionUser = {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    entryPaidAt: user.entryPaidAt,
    hasLeagueAccess: user.role !== "ADMIN" && leagueCount > 0,
  };

  await setAuthCookie(signToken(sessionUser));

  return Response.json({ user: sessionUser, joinedLeague });
}
