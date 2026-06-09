import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateWorldCupResultsFromApiFootball } from "@/lib/football-results";
import { recalculateFinishedMatchPoints } from "@/lib/recalculate-points";
import { notifyWhatsAppUsers } from "@/lib/whatsapp";

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  try {
    const result = await updateWorldCupResultsFromApiFootball();
    const predictionsUpdated = await recalculateFinishedMatchPoints();

    if (result.updated > 0) {
      await notifyWhatsAppUsers(
        `Resultados reales actualizados en Copa Mundial de la FIFA 2026™. Partidos actualizados: ${result.updated}. Picks recalculados: ${predictionsUpdated}.`,
      );
    }

    return Response.json({
      ...result,
      predictionsUpdated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron actualizar los resultados";
    console.error("Automatic results update failed", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
