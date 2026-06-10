import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { approveEntryPayment, getWompiTransaction } from "@/lib/wompi";

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
    const payment = await prisma.entryPayment.findUnique({
      where: { reference: transaction.reference },
    });

    if (!payment || payment.userId !== user.id) {
      return Response.json({ error: "Inscripcion no encontrada para este usuario" }, { status: 404 });
    }

    await prisma.entryPayment.update({
      where: { reference: transaction.reference },
      data: {
        status: transaction.status,
        transactionId: transaction.id,
      },
    });

    if (transaction.status === "APPROVED") {
      await approveEntryPayment(transaction.reference, transaction.id);
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, phone: true, role: true, isActive: true, entryPaidAt: true },
    });

    return Response.json({ user: updatedUser, status: transaction.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo confirmar la inscripcion";
    return Response.json({ error: message }, { status: 500 });
  }
}
