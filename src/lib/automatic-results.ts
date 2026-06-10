import { updateWorldCupResultsFromApiFootball } from "@/lib/football-results";
import { recalculateFinishedMatchPoints } from "@/lib/recalculate-points";
import { notifyWhatsAppUsers } from "@/lib/whatsapp";

export async function updateResultsAndRecalculate() {
  const result = process.env.API_FOOTBALL_KEY
    ? await updateWorldCupResultsFromApiFootball()
    : { checked: 0, updated: 0, updatedMatches: [], source: "Sin API-Football configurado" };
  const predictionsUpdated = await recalculateFinishedMatchPoints();

  if (result.updatedMatches.length > 0) {
    const scoreLines = result.updatedMatches
      .slice(0, 8)
      .map((match) => `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`)
      .join("\n");
    const extraMatches = result.updatedMatches.length > 8 ? `\nY ${result.updatedMatches.length - 8} resultado(s) mas.` : "";

    await notifyWhatsAppUsers(
      `Resultados actualizados Copa Mundial de la FIFA 2026™:\n${scoreLines}${extraMatches}\nPicks recalculados: ${predictionsUpdated}.`,
    );
  }

  return {
    ...result,
    predictionsUpdated,
  };
}
