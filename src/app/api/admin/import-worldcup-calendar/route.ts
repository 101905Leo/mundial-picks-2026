import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { importWorldCupCalendar } from "@/lib/worldcup-calendar";
import { notifyWhatsAppUsers } from "@/lib/whatsapp";

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  try {
    const result = await importWorldCupCalendar();

    await notifyWhatsAppUsers(
      `Mundial Picks Arena: calendario actualizado. Partidos cargados: ${result.total}.`,
    );

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo importar el calendario";
    console.error("World Cup calendar import failed", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
