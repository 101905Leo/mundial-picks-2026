import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { createWompiRoomCheckout } from "@/lib/wompi";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const { id } = await params;
  const league = await prisma.league.findFirst({
    where: { id, ownerId: user!.id },
    select: { id: true, paymentAmountInCents: true, paidAt: true },
  });

  if (!league) {
    return Response.json({ error: "Sala no encontrada o no administrada por ti" }, { status: 404 });
  }

  if (league.paidAt) {
    return Response.json({ error: "Esta sala ya tiene su cupo pagado" }, { status: 409 });
  }
  if (league.paymentAmountInCents <= 0) {
    return Response.json({ error: "La sala no tiene un monto de pago válido" }, { status: 409 });
  }

  try {
    const checkout = await createWompiRoomCheckout({
      leagueId: league.id,
      user: { name: user!.name, phone: user!.phone },
      amountInCents: league.paymentAmountInCents,
    });
    return Response.json({ checkout });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo abrir el pago de la sala";
    return Response.json({ error: message }, { status: 500 });
  }
}
