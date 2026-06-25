import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isRoomActivated, ROOM_PENDING_PAYMENT_ERROR, ROOM_PENDING_PAYMENT_STATUS } from "@/lib/room-activation";

const messageSchema = z.object({
  body: z.string().trim().min(1, "Escribe un mensaje").max(2000, "El mensaje es demasiado largo"),
});

const deleteMessageSchema = z.object({
  messageId: z.string().min(1, "Mensaje inválido"),
});

async function getLeagueAccess(userId: string, userRole: "USER" | "ADMIN", leagueId: string) {
  if (userRole === "ADMIN") {
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { status: true, expiresAt: true, paidAt: true, paymentStatus: true },
    });
    return league ? { id: "SUPER_ADMIN", league } : null;
  }

  return prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId } },
    select: {
      id: true,
      league: { select: { status: true, expiresAt: true, paidAt: true, paymentStatus: true } },
    },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  if (user!.role !== "ADMIN" && !user!.isActive) {
    return Response.json({ error: "Tu usuario está desactivado para usar el chat." }, { status: 403 });
  }

  const { id } = await params;
  const access = await getLeagueAccess(user!.id, user!.role, id);
  if (!access) {
    return Response.json({ error: "No perteneces a esta sala" }, { status: 403 });
  }
  if (!isRoomActivated(access.league)) {
    return Response.json({ error: ROOM_PENDING_PAYMENT_ERROR }, { status: ROOM_PENDING_PAYMENT_STATUS });
  }

  const messages = await prisma.leagueMessage.findMany({
    where: { leagueId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: { select: { id: true, name: true, role: true } },
    },
  });

  return Response.json({ messages: messages.reverse() });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  if (user!.role !== "ADMIN" && !user!.isActive) {
    return Response.json({ error: "Tu usuario está desactivado para usar el chat." }, { status: 403 });
  }

  const { id } = await params;
  const access = await getLeagueAccess(user!.id, user!.role, id);
  if (!access) {
    return Response.json({ error: "No perteneces a esta sala" }, { status: 403 });
  }
  if (!isRoomActivated(access.league)) {
    return Response.json({ error: ROOM_PENDING_PAYMENT_ERROR }, { status: ROOM_PENDING_PAYMENT_STATUS });
  }
  if (
    access.league.status !== "ACTIVE" ||
    Boolean(access.league.expiresAt && access.league.expiresAt <= new Date())
  ) {
    return Response.json({ error: "La sala no está activa para enviar mensajes" }, { status: 403 });
  }

  const parsed = messageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Mensaje invalido" }, { status: 400 });
  }

  const message = await prisma.leagueMessage.create({
    data: {
      leagueId: id,
      userId: user!.id,
      body: parsed.data.body,
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: { select: { id: true, name: true, role: true } },
    },
  });

  return Response.json({ message }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  if (user!.role !== "ADMIN") {
    return Response.json({ error: "Solo el super usuario puede borrar mensajes." }, { status: 403 });
  }

  const { id } = await params;
  const access = await getLeagueAccess(user!.id, user!.role, id);
  if (!access) {
    return Response.json({ error: "No perteneces a esta sala" }, { status: 403 });
  }

  const parsed = deleteMessageSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Mensaje inválido" }, { status: 400 });
  }

  const message = await prisma.leagueMessage.findFirst({
    where: {
      id: parsed.data.messageId,
      leagueId: id,
    },
    select: { id: true },
  });

  if (!message) {
    return Response.json({ error: "Mensaje no encontrado" }, { status: 404 });
  }

  await prisma.leagueMessage.delete({
    where: { id: message.id },
  });

  return Response.json({ deleted: message.id });
}
