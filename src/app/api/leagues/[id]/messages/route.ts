import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const messageSchema = z.object({
  body: z.string().trim().max(500, "El mensaje es demasiado largo").default(""),
  audioData: z.string().max(500_000, "La nota de voz es demasiado larga").optional(),
  audioMime: z.string().max(80).optional(),
  audioDuration: z.number().int().min(1).max(30).optional(),
}).refine((value) => value.body.length > 0 || Boolean(value.audioData), {
  message: "Escribe un mensaje o graba una nota de voz",
});

async function canAccessLeague(userId: string, leagueId: string) {
  return prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId } },
    select: { id: true },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const { id } = await params;
  if (!(await canAccessLeague(user!.id, id))) {
    return Response.json({ error: "No perteneces a esta sala" }, { status: 403 });
  }

  const messages = await prisma.leagueMessage.findMany({
    where: { leagueId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      body: true,
      audioData: true,
      audioMime: true,
      audioDuration: true,
      createdAt: true,
      user: { select: { id: true, name: true, role: true } },
    },
  });

  return Response.json({ messages: messages.reverse() });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const { id } = await params;
  if (!(await canAccessLeague(user!.id, id))) {
    return Response.json({ error: "No perteneces a esta sala" }, { status: 403 });
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
      audioData: parsed.data.audioData,
      audioMime: parsed.data.audioMime,
      audioDuration: parsed.data.audioDuration,
    },
    select: {
      id: true,
      body: true,
      audioData: true,
      audioMime: true,
      audioDuration: true,
      createdAt: true,
      user: { select: { id: true, name: true, role: true } },
    },
  });

  return Response.json({ message }, { status: 201 });
}
