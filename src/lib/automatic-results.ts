import { updateWorldCupResultsFromApiFootball } from "@/lib/football-results";
import { recalculateFinishedMatchPoints } from "@/lib/recalculate-points";
import { notifyWhatsAppUsers } from "@/lib/whatsapp";

export async function updateResultsAndRecalculate() {
  const result = process.env.API_FOOTBALL_KEY
    ? await updateWorldCupResultsFromApiFootball()
    : { checked: 0, updated: 0, source: "Sin API-Football configurado" };
  const predictionsUpdated = await recalculateFinishedMatchPoints();

  if (result.updated > 0) {
    await notifyWhatsAppUsers(
      `Resultados reales actualizados en Copa Mundial de la FIFA 2026™. Partidos actualizados: ${result.updated}. Picks recalculados: ${predictionsUpdated}.`,
    );
  }

  return {
    ...result,
    predictionsUpdated,
  };
}
