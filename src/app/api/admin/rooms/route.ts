import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const trialSchema = z.object({
  name: z.string().trim().min(3).max(80),
  ownerId: z.string().min(1),
  competitionId: z.string().min(1),
  mode: z.enum(["TRIAL", "MANUAL"]).default("TRIAL"),
  planId: z.string().optional(),
  maxParticipants: z.number().int().min(2).max(10000).optional(),
  expiresAt: z.string().datetime().optional(),
  pricePaidCop: z.number().int().min(0).optional(),
});

const roleSchema = z.object({
  leagueId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["MEMBER", "ADMIN"]),
});

const roomSettingsSchema = z.object({
  action: z.literal("roomSettings"),
  leagueId: z.string().min(1),
  name: z.string().trim().min(3).max(80).optional(),
  ownerId: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "EXPIRED", "SUSPENDED", "CLOSED"]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxParticipants: z.number().int().min(2).max(10000).optional(),
});

async function uniqueRoomCode(maxParticipants: number) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `MP${String(maxParticipants).padStart(2, "0")}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    if (!(await prisma.league.findUnique({ where: { inviteCode: code }, select: { id: true } }))) return code;
  }
  throw new Error("No se pudo generar el código de la sala");
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
      status: true,
      expiresAt: true,
      description: true,
      rules: true,
      paymentStatus: true,
      paymentAmountInCents: true,
      paidAt: true,
      plan: { select: { id: true, name: true, slug: true } },
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

  const now = new Date();
  const activeRooms = rooms.filter((room) => room.status === "ACTIVE" && (!room.expiresAt || room.expiresAt > now)).length;
  const expiredRooms = rooms.filter((room) => room.status === "EXPIRED" || Boolean(room.expiresAt && room.expiresAt <= now)).length;
  const incomeInCents = rooms
    .filter((room) => Boolean(room.paidAt))
    .reduce((sum, room) => sum + room.paymentAmountInCents, 0);

  return Response.json({ rooms, summary: { total: rooms.length, activeRooms, expiredRooms, incomeInCents } });
}

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const parsed = trialSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Datos de prueba inválidos" }, { status: 400 });
  }

  const [owner, competition, plan] = await Promise.all([
    prisma.user.findUnique({ where: { id: parsed.data.ownerId }, select: { id: true, name: true } }),
    prisma.competition.findUnique({ where: { id: parsed.data.competitionId }, select: { id: true } }),
    parsed.data.planId
      ? prisma.roomPlan.findUnique({ where: { id: parsed.data.planId } })
      : Promise.resolve(null),
  ]);

  if (!owner || !competition) {
    return Response.json({ error: "Usuario o liga no encontrado" }, { status: 404 });
  }

  const maxParticipants =
    parsed.data.mode === "TRIAL"
      ? 10
      : parsed.data.maxParticipants ?? plan?.participantLimit ?? 20;
  const paidAt = new Date();
  const expiresAt = parsed.data.expiresAt
    ? new Date(parsed.data.expiresAt)
    : new Date(paidAt.getTime() + (plan?.durationDays ?? 365) * 24 * 60 * 60 * 1000);
  const room = await prisma.league.create({
    data: {
      name: parsed.data.name,
      inviteCode: await uniqueRoomCode(maxParticipants),
      ownerId: owner.id,
      competitionId: competition.id,
      planId: parsed.data.mode === "MANUAL" ? plan?.id : undefined,
      maxParticipants,
      status: "ACTIVE",
      expiresAt,
      description: "Sala privada creada y administrada desde Mundial Picks.",
      rules: "El propietario puede publicar aquí las reglas internas de su grupo.",
      paymentStatus: parsed.data.mode,
      paymentAmountInCents: (parsed.data.pricePaidCop ?? 0) * 100,
      paidAt,
      memberships: { create: { userId: owner.id, role: "ADMIN" } },
    },
    select: { id: true, name: true, inviteCode: true, maxParticipants: true, expiresAt: true },
  });

  return Response.json({ room, owner: owner.name }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const body = await request.json();
  if (body.action === "roomSettings") {
    const parsedSettings = roomSettingsSchema.safeParse(body);
    if (!parsedSettings.success) {
      return Response.json({ error: parsedSettings.error.issues[0]?.message ?? "Configuración inválida" }, { status: 400 });
    }

    const current = await prisma.league.findUnique({
      where: { id: parsedSettings.data.leagueId },
      include: { _count: { select: { memberships: true } } },
    });
    if (!current) return Response.json({ error: "Sala no encontrada" }, { status: 404 });
    if (
      parsedSettings.data.maxParticipants &&
      parsedSettings.data.maxParticipants < current._count.memberships
    ) {
      return Response.json({ error: "El cupo no puede ser menor que los participantes actuales" }, { status: 409 });
    }

    const room = await prisma.$transaction(async (tx) => {
      if (parsedSettings.data.ownerId) {
        const owner = await tx.user.findUnique({ where: { id: parsedSettings.data.ownerId }, select: { id: true } });
        if (!owner) throw new Error("El nuevo propietario no existe");
        await tx.leagueMembership.upsert({
          where: {
            userId_leagueId: {
              userId: owner.id,
              leagueId: current.id,
            },
          },
          create: { userId: owner.id, leagueId: current.id, role: "ADMIN" },
          update: { role: "ADMIN" },
        });
      }

      return tx.league.update({
        where: { id: current.id },
        data: {
          name: parsedSettings.data.name,
          ownerId: parsedSettings.data.ownerId,
          status: parsedSettings.data.status,
          expiresAt:
            parsedSettings.data.expiresAt === undefined
              ? undefined
              : parsedSettings.data.expiresAt
                ? new Date(parsedSettings.data.expiresAt)
                : null,
          maxParticipants: parsedSettings.data.maxParticipants,
        },
        select: { id: true, name: true, status: true, expiresAt: true, maxParticipants: true },
      });
    });

    return Response.json({ room });
  }

  const parsed = roleSchema.safeParse(body);
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
