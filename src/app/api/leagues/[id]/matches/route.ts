import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { roomMatchScopeWhere } from "@/lib/room-match-scope";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const { id } = await params;
  const league = await prisma.league.findFirst({
    where: { id, memberships: { some: { userId: user!.id } } },
    select: { id: true, competitionId: true },
  });

  if (!league) {
    return Response.json({ error: "No perteneces a esta sala" }, { status: 403 });
  }

  const matches = await prisma.match.findMany({
    where: {
      isPublished: true,
      ...roomMatchScopeWhere(league),
    },
    orderBy: { startsAt: "asc" },
    include: {
      predictions: {
        where: { userId: user!.id },
        select: { id: true, homeScore: true, awayScore: true, points: true },
      },
    },
  });

  return Response.json({ matches });
}
