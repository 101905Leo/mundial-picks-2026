import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { removeSuperAdminRoomMemberships } from "@/lib/remove-super-admin-room-memberships";
import { joinLeagueSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const body = await request.json();
  const parsed = joinLeagueSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Codigo invalido" }, { status: 400 });
  }

  const league = await prisma.league.findUnique({
    where: { inviteCode: parsed.data.inviteCode.toUpperCase() },
  });

  if (!league) {
    return Response.json({ error: "Sala no encontrada" }, { status: 404 });
  }

  if (user!.role === "ADMIN") {
    return Response.json({ league, membership: null, spectator: true });
  }

  await removeSuperAdminRoomMemberships();

  if (!league.paidAt || !["APPROVED", "TRIAL", "MANUAL"].includes(league.paymentStatus)) {
    return Response.json({ error: "Esta sala todavía no ha confirmado el pago de su cupo" }, { status: 403 });
  }

  if (league.status !== "ACTIVE" || (league.expiresAt && league.expiresAt <= new Date())) {
    return Response.json({ error: "Esta sala está vencida, suspendida o cerrada" }, { status: 403 });
  }

  const existingMembership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: user!.id, leagueId: league.id } },
  });
  const participants = await prisma.leagueMembership.count({ where: { leagueId: league.id } });

  if (!existingMembership && participants >= league.maxParticipants) {
    return Response.json({ error: "Esta sala ya completo su cupo de participantes" }, { status: 409 });
  }

  const membership = await prisma.leagueMembership.upsert({
    where: { userId_leagueId: { userId: user!.id, leagueId: league.id } },
    update: {},
    create: { userId: user!.id, leagueId: league.id },
  });
  if (!user!.isActive) {
    await prisma.user.update({
      where: { id: user!.id },
      data: { isActive: true },
    });
  }

  return Response.json({ league, membership });
}
