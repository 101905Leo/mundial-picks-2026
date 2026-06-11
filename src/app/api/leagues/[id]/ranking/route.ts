import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const { id } = await params;
  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: user!.id, leagueId: id } },
  });

  if (!membership) {
    return Response.json({ error: "No perteneces a esta liga" }, { status: 403 });
  }

  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
              predictions: { select: { points: true } },
            },
          },
        },
      },
    },
  });

  if (!league) {
    return Response.json({ error: "Liga no encontrada" }, { status: 404 });
  }

  const ranking = league.memberships
    .filter(({ user: member }) => member.role !== "ADMIN")
    .map(({ user: member }) => ({
      id: member.id,
      name: member.name,
      points: member.predictions.reduce((sum, prediction) => sum + prediction.points, 0),
      predictions: member.predictions.length,
    }))
    .sort((a, b) => b.points - a.points || b.predictions - a.predictions);

  return Response.json({ league: { id: league.id, name: league.name, inviteCode: league.inviteCode }, ranking });
}
