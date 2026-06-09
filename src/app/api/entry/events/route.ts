import { prisma } from "@/lib/prisma";
import { approveEntryPayment, verifyWompiEvent } from "@/lib/wompi";

export async function POST(request: Request) {
  const event = await request.json();

  if (!verifyWompiEvent(event)) {
    return Response.json({ error: "Evento no verificado" }, { status: 400 });
  }

  if (event.event === "transaction.updated") {
    const transaction = event.data?.transaction;

    if (transaction?.reference) {
      await prisma.entryPayment.updateMany({
        where: { reference: transaction.reference },
        data: {
          status: transaction.status,
          transactionId: transaction.id,
        },
      });

      if (transaction.status === "APPROVED") {
        await approveEntryPayment(transaction.reference, transaction.id);
      }
    }
  }

  return Response.json({ received: true });
}
