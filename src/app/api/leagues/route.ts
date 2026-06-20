import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { leagueSchema } from "@/lib/validators";
import { createWompiRoomCheckout } from "@/lib/wompi";

function inviteCode(maxParticipants: number) {
  const capacity = String(maxParticipants).padStart(2, "0");
  return `MP${capacity}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

async function uniqueInviteCode(maxParticipants: number) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = inviteCode(maxParticipants);
    const existingLeague = await prisma.league.findUnique({ where: { inviteCode: code }, select: { id: true } });

    if (!existingLeague) return code;
  }

  throw new Error("No se pudo generar codigo de invitacion");
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const leagues = await prisma.league.findMany({
    where: user!.role === "ADMIN" ? {} : { memberships: { some: { userId: user!.id } } },
    include: {
      memberships: { select: { id: true, userId: true, role: true } },
      competition: { select: { id: true, name: true, season: true, country: true } },
      plan: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ leagues });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  if (user!.role === "ADMIN") {
    return Response.json(
      { error: "El super usuario administra la app, pero no puede crear salas como participante." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = leagueSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Datos de sala inválidos" }, { status: 400 });
  }

  try {
    const maxParticipants = parsed.data.maxParticipants;
    const planSlug =
      maxParticipants === 20 ? "sala-basica" : maxParticipants === 50 ? "sala-pro" : "sala-premium";
    const plan = await prisma.roomPlan.findUnique({ where: { slug: planSlug } });
    if (!plan || !plan.isActive || plan.participantLimit !== maxParticipants || plan.priceInCents <= 0) {
      return Response.json({ error: "El plan seleccionado no está disponible para pago." }, { status: 409 });
    }

    const competition =
      (parsed.data.competitionId
        ? await prisma.competition.findUnique({ where: { id: parsed.data.competitionId } })
        : await prisma.competition.findUnique({ where: { slug: "mundial-2026" } })) ??
      (await prisma.competition.findFirst({ where: { isActive: true } }));

    if (!competition) {
      return Response.json({ error: "No hay una liga disponible para crear la sala" }, { status: 409 });
    }

    const league = await prisma.$transaction(async (tx) => {
      const createdLeague = await tx.league.create({
        data: {
          name: parsed.data.name,
          inviteCode: await uniqueInviteCode(maxParticipants),
          ownerId: user!.id,
          competitionId: competition.id,
          planId: plan?.id,
          maxParticipants,
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + (plan?.durationDays ?? 365) * 24 * 60 * 60 * 1000),
          description: parsed.data.description || "Sala privada de picks para amigos, familia o compañeros.",
          rules: parsed.data.rules || "El administrador de la sala define las reglas internas para sus participantes.",
          memberships: {
            create: { userId: user!.id, role: "ADMIN" },
          },
        },
        include: {
          competition: { select: { id: true, name: true, season: true, country: true } },
          plan: true,
          memberships: { select: { id: true, userId: true, role: true } },
        },
      });

      if (parsed.data.firstMatch) {
        await tx.match.create({
          data: {
            homeTeam: parsed.data.firstMatch.homeTeam,
            awayTeam: parsed.data.firstMatch.awayTeam,
            startsAt: new Date(parsed.data.firstMatch.startsAt),
            isPublished: true,
            competitionId: competition.id,
            roomId: createdLeague.id,
            group: `Sala ${createdLeague.name}`,
          },
        });
      }

      return createdLeague;
    });

    const checkout = await createWompiRoomCheckout({
      leagueId: league.id,
      user: { name: user!.name, phone: user!.phone },
      amountInCents: plan.priceInCents,
      maxParticipants,
    });

    return Response.json({ league: { ...league, paymentStatus: "PENDING", paidAt: null }, checkout }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la sala. Intenta de nuevo.";
    return Response.json({ error: message }, { status: 500 });
  }
}
