import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { notifyWhatsAppUsers } from "@/lib/whatsapp";

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const result = await notifyWhatsAppUsers(
    "mensaje de prueba enviado desde el panel administrador. Si recibes este aviso, WhatsApp quedo conectado",
  );

  return Response.json(result);
}
