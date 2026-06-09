import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
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
    return Response.json({ error: "Liga no encontrada" }, { status: 404 });
  }

  const membership = await prisma.leagueMembership.upsert({
    where: { userId_leagueId: { userId: user!.id, leagueId: league.id } },
    update: {},
    create: { userId: user!.id, leagueId: league.id },
  });

  return Response.json({ league, membership });
}
