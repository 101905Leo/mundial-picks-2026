import { updateWorldCupResultsFromApiFootball } from "@/lib/football-results";
import { updateWorldCupResultsFromFootballData } from "@/lib/football-data-results";
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

  const providers = [
    process.env.FOOTBALL_DATA_API_KEY
      ? { name: "football-data.org", update: updateWorldCupResultsFromFootballData }
      : null,
    process.env.API_FOOTBALL_KEY
      ? { name: "API-Football", update: updateWorldCupResultsFromApiFootball }
      : null,
  ].filter((provider): provider is { name: string; update: typeof updateWorldCupResultsFromApiFootball } => Boolean(provider));

  let result:
    | Awaited<ReturnType<typeof updateWorldCupResultsFromApiFootball>>
    | Awaited<ReturnType<typeof updateWorldCupResultsFromFootballData>>
    | null = null;
  const providerErrors: string[] = [];

  for (const provider of providers) {
    try {
      result = await provider.update();
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      providerErrors.push(`${provider.name}: ${message}`);
    }
  }

  if (!result && providers.length > 0) {
    throw new Error(`Ningun proveedor pudo actualizar resultados. ${providerErrors.join(" | ")}`);
  }

  const resolvedResult = result ?? {
    checked: 0,
    received: 0,
    matched: 0,
    updated: 0,
    updatedMatches: [],
    source: "Sin proveedor de resultados configurado",
  };
  const predictionsUpdated = await recalculateFinishedMatchPoints();

  if (resolvedResult.updatedMatches.length > 0) {
    const scoreLines = resolvedResult.updatedMatches
      .slice(0, 8)
      .map((match) => `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`)
      .join("\n");
    const extraMatches =
      resolvedResult.updatedMatches.length > 8
        ? `\nY ${resolvedResult.updatedMatches.length - 8} resultado(s) mas.`
        : "";

    await notifyWhatsAppUsers(
      `Resultados actualizados Copa Mundial de la FIFA 2026™:\n${scoreLines}${extraMatches}\nPicks recalculados: ${predictionsUpdated}.`,
    );
  }

  return {
    ...resolvedResult,
    predictionsUpdated,
  };
}
