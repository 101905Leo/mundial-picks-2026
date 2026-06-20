import { prisma } from "@/lib/prisma";
import { applyWompiPayment, verifyWompiEvent } from "@/lib/wompi";

export async function POST(request: Request) {
  const event = await request.json();

  if (!verifyWompiEvent(event)) {
    return Response.json({ error: "Evento no verificado" }, { status: 400 });
  }

  if (event.event === "transaction.updated") {
    const transaction = event.data?.transaction;

    if (transaction?.reference) {
      const reference = String(transaction.reference);
      const status = String(transaction.status ?? "");
      const transactionId = String(transaction.id ?? "");
      const amountInCents = Number(transaction.amount_in_cents);

      try {
        if (status === "APPROVED" || reference.startsWith("room_")) {
          await applyWompiPayment(reference, transactionId, status, amountInCents);
        } else {
          await prisma.entryPayment.updateMany({
            where: { reference },
            data: {
              status,
              transactionId,
            },
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo aplicar el evento de pago";
        return Response.json({ error: message }, { status: message.includes("monto") ? 400 : 500 });
      }
    }
  }

  return Response.json({ received: true });
}
