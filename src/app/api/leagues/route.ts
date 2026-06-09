import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { leagueSchema } from "@/lib/validators";

function inviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const leagues = await prisma.league.findMany({
    where: { memberships: { some: { userId: user!.id } } },
    include: { memberships: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ leagues });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const body = await request.json();
  const parsed = leagueSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Nombre de liga invalido" }, { status: 400 });
  }

  const league = await prisma.league.create({
    data: {
      name: parsed.data.name,
      inviteCode: inviteCode(),
      ownerId: user!.id,
      memberships: {
        create: { userId: user!.id },
      },
    },
  });

  return Response.json({ league }, { status: 201 });
}
