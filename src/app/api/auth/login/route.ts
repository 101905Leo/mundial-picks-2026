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
    return Response.json({ error: "Celular o contrasena incorrectos" }, { status: 401 });
  }

  let joinedLeague = null;

  if (inviteCode) {
    const league = await prisma.league.findUnique({ where: { inviteCode } });

    if (!league) {
      return Response.json({ error: "Codigo de sala no encontrado" }, { status: 404 });
    }

    await prisma.leagueMembership.upsert({
      where: { userId_leagueId: { userId: user.id, leagueId: league.id } },
      update: {},
      create: { userId: user.id, leagueId: league.id },
    });

    joinedLeague = league;
  }

  const leagueCount = await prisma.leagueMembership.count({ where: { userId: user.id } });
  const sessionUser = {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    entryPaidAt: user.entryPaidAt,
    hasLeagueAccess: leagueCount > 0,
  };

  await setAuthCookie(signToken(sessionUser));

  return Response.json({ user: sessionUser, joinedLeague });
}
