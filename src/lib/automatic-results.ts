import { updateWorldCupResultsFromApiFootball } from "@/lib/football-results";
import { recalculateFinishedMatchPoints } from "@/lib/recalculate-points";
import { notifyWhatsAppUsers } from "@/lib/whatsapp";

export function isAutomaticResultsWindow(date = new Date()) {
  const hourInBogota = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Bogota",
      hour: "2-digit",
      hour12: false,
    }).format(date),
  );

  return hourInBogota >= 14 && hourInBogota <= 23;
}

export async function updateResultsAndRecalculate(options: { enforceSchedule?: boolean } = {}) {
  if (options.enforceSchedule && !isAutomaticResultsWindow()) {
    return {
      checked: 0,
      received: 0,
      matched: 0,
      updated: 0,
      updatedMatches: [],
      predictionsUpdated: 0,
      skipped: true,
      source: "Fuera del horario automatico de 14:00 a 00:00 America/Bogota",
    };
  }

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
