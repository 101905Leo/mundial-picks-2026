import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { applyWompiPayment, getWompiTransaction } from "@/lib/wompi";

export async function POST(request: NextRequest) {
  const user = await getSessionFromRequest(request);
  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { transactionId } = await request.json();
  if (!transactionId) {
    return Response.json({ error: "Falta transactionId" }, { status: 400 });
  }

  try {
    const transaction = await getWompiTransaction(String(transactionId));
    if (transaction.reference.startsWith("room_")) {
      const league = await prisma.league.findUnique({
        where: { paymentReference: transaction.reference },
        select: { ownerId: true },
      });

      if (!league || league.ownerId !== user.id) {
        return Response.json({ error: "Pago de sala no encontrado para este usuario" }, { status: 404 });
      }
    } else {
      const payment = await prisma.entryPayment.findUnique({
        where: { reference: transaction.reference },
      });

      if (!payment || payment.userId !== user.id) {
        return Response.json({ error: "Inscripcion no encontrada para este usuario" }, { status: 404 });
      }
    }

    const result = await applyWompiPayment(transaction.reference, transaction.id, transaction.status);
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, phone: true, role: true, isActive: true, entryPaidAt: true },
    });

    return Response.json({ user: updatedUser, status: transaction.status, paymentType: result.type });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo confirmar la inscripcion";
    return Response.json({ error: message }, { status: 500 });
  }
}
