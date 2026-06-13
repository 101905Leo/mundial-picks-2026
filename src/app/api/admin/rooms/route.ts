import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const trialSchema = z.object({
  name: z.string().trim().min(3).max(80),
  ownerId: z.string().min(1),
  competitionId: z.string().min(1),
});

const roleSchema = z.object({
  leagueId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["MEMBER", "ADMIN"]),
});

async function uniqueTrialCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `MP10${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    if (!(await prisma.league.findUnique({ where: { inviteCode: code }, select: { id: true } }))) return code;
  }
  throw new Error("No se pudo generar el código de prueba");
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const rooms = await prisma.league.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      inviteCode: true,
      ownerId: true,
      maxParticipants: true,
      paymentStatus: true,
      paidAt: true,
      competition: { select: { id: true, name: true, season: true } },
      owner: { select: { id: true, name: true, phone: true } },
      memberships: {
        orderBy: { joinedAt: "asc" },
        select: {
          role: true,
          user: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  });

  return Response.json({ rooms });
}

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const parsed = trialSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Datos de prueba inválidos" }, { status: 400 });
  }

  const [owner, competition] = await Promise.all([
    prisma.user.findUnique({ where: { id: parsed.data.ownerId }, select: { id: true, name: true } }),
    prisma.competition.findUnique({ where: { id: parsed.data.competitionId }, select: { id: true } }),
  ]);

  if (!owner || !competition) {
    return Response.json({ error: "Usuario o liga no encontrado" }, { status: 404 });
  }

  const room = await prisma.league.create({
    data: {
      name: parsed.data.name,
      inviteCode: await uniqueTrialCode(),
      ownerId: owner.id,
      competitionId: competition.id,
      maxParticipants: 10,
      paymentStatus: "TRIAL",
      paymentAmountInCents: 0,
      paidAt: new Date(),
      memberships: { create: { userId: owner.id, role: "ADMIN" } },
    },
    select: { id: true, name: true, inviteCode: true, maxParticipants: true },
  });

  return Response.json({ room, owner: owner.name }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const parsed = roleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Sala, usuario o rol inválido" }, { status: 400 });
  }

  const room = await prisma.league.findUnique({
    where: { id: parsed.data.leagueId },
    select: { ownerId: true, name: true },
  });
  if (!room) {
    return Response.json({ error: "Sala no encontrada" }, { status: 404 });
  }
  if (room.ownerId === parsed.data.userId && parsed.data.role !== "ADMIN") {
    return Response.json({ error: "El creador siempre debe ser administrador de su sala" }, { status: 409 });
  }

  const existingMembership = await prisma.leagueMembership.findUnique({
    where: {
      userId_leagueId: {
        userId: parsed.data.userId,
        leagueId: parsed.data.leagueId,
      },
    },
    select: { id: true },
  });
  if (!existingMembership) {
    return Response.json({ error: "El usuario debe pertenecer a la sala antes de asignarle un rol" }, { status: 404 });
  }

  const membership = await prisma.leagueMembership.update({
    where: {
      userId_leagueId: {
        userId: parsed.data.userId,
        leagueId: parsed.data.leagueId,
      },
    },
    data: { role: parsed.data.role },
    select: {
      role: true,
      user: { select: { id: true, name: true } },
    },
  });

  return Response.json({ room: room.name, membership });
}
