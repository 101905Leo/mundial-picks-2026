import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { notifyWhatsAppUsers } from "@/lib/whatsapp";

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const now = new Date().toLocaleString("es-CO");

  const result = await notifyWhatsAppUsers(
    `Mundial Picks Arena: mensaje de prueba enviado desde el panel administrador. Hora: ${now}. Si recibes este aviso, WhatsApp quedo conectado.`,
  );

  return Response.json(result);
}
