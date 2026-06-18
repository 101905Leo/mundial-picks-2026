import { updateWorldCupResultsFromApiFootball } from "@/lib/football-results";
import { updateWorldCupResultsFromFootballData } from "@/lib/football-data-results";
import { recalculateFinishedMatchPoints } from "@/lib/recalculate-points";
import { syncRoomResultsFromGlobal } from "@/lib/sync-room-results";
import { notifyWhatsAppUsers } from "@/lib/whatsapp";

export function isAutomaticResultsWindow(date = new Date()) {
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    hour: "numeric",
    hour12: false,
  })
    .formatToParts(date)
    .find((part) => part.type === "hour");
  const hourInBogota = Number(hourPart?.value ?? "0") % 24;

  return hourInBogota >= 14 || hourInBogota === 0;
}

export async function updateResultsAndRecalculate(options: { enforceSchedule?: boolean; notify?: boolean } = {}) {
  if (options.enforceSchedule && !isAutomaticResultsWindow()) {
    return {
      checked: 0,
      received: 0,
      matched: 0,
      updated: 0,
      updatedMatches: [],
      roomMatchesSynced: 0,
      roomMatchesMatched: 0,
      roomMatchesAlreadySynced: 0,
      predictionsUpdated: 0,
      skipped: true,
      source: "Fuera del horario automatico de 14:00 a 00:59 America/Bogota",
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

  const resolvedResult = result ?? {
    checked: 0,
    received: 0,
    matched: 0,
    updated: 0,
    updatedMatches: [],
    roomMatchesSynced: 0,
    roomMatchesMatched: 0,
    roomMatchesAlreadySynced: 0,
    source:
      providers.length > 0
        ? `Proveedor externo sin actualización: ${providerErrors.join(" | ")}`
        : "Sin proveedor de resultados configurado",
  };
  const roomSync = await syncRoomResultsFromGlobal();
  const roomMatchesSynced = roomSync.updated;
  const predictionsUpdated = await recalculateFinishedMatchPoints();

  if (options.notify !== false && (resolvedResult.updatedMatches.length > 0 || roomMatchesSynced > 0)) {
    const scoreLines = resolvedResult.updatedMatches
      .slice(0, 8)
      .map((match) => `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`)
      .join("\n");
    const extraMatches =
      resolvedResult.updatedMatches.length > 8
        ? `\nY ${resolvedResult.updatedMatches.length - 8} resultado(s) mas.`
        : "";

    await notifyWhatsAppUsers(
      `Resultados actualizados Copa Mundial de la FIFA 2026™:\n${scoreLines || "Salas sincronizadas con resultados existentes."}${extraMatches}\nPartidos de sala sincronizados: ${roomMatchesSynced}.\nPicks recalculados: ${predictionsUpdated}.`,
    );
  }

  return {
    ...resolvedResult,
    roomMatchesSynced,
    roomMatchesMatched: roomSync.matched,
    roomMatchesAlreadySynced: roomSync.alreadySynced,
    predictionsUpdated,
    providerErrors,
  };
}
