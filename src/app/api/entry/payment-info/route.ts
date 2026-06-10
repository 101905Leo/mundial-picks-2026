import { entryFee } from "@/lib/wompi";

export async function GET() {
  const fee = entryFee();

  return Response.json({
    priceCop: fee.priceCop,
    method: process.env.MANUAL_PAYMENT_METHOD || "Transferencia manual",
    holder: process.env.MANUAL_PAYMENT_HOLDER || "",
    account: process.env.MANUAL_PAYMENT_ACCOUNT || "",
    note: process.env.MANUAL_PAYMENT_NOTE || "Envía el comprobante al administrador para activar tu inscripción.",
  });
}
