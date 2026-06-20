import { updateWorldCupResultsFromApiFootball } from "@/lib/football-results";
import { updateWorldCupResultsFromFootballData } from "@/lib/football-data-results";
import { recalculateFinishedMatchPoints } from "@/lib/recalculate-points";
import { syncRoomResultsFromGlobal } from "@/lib/sync-room-results";
import { notifyWhatsAppUsers } from "@/lib/whatsapp";

type ResultsProviderResult =
  | Awaited<ReturnType<typeof updateWorldCupResultsFromApiFootball>>
  | Awaited<ReturnType<typeof updateWorldCupResultsFromFootballData>>;

type ResultsProvider = {
  name: string;
  update: () => Promise<ResultsProviderResult>;
};

export function isAutomaticResultsWindow(date = new Date()) {
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    hour: "numeric",
    hour12: false,
  })
    .formatToParts(date)
    .find((part) => part.type === "hour");
  const hourInBogota = Number(hourPart?.value ?? "0") % 24;

  return hourInBogota >= 7 || hourInBogota === 0;
}

function hasUsefulProviderUpdate(result: ResultsProviderResult) {
  return result.updated > 0 || result.updatedMatches.length > 0;
}

function pickBestProviderResult(current: ResultsProviderResult | null, next: ResultsProviderResult) {
  if (!current) return next;
  if (next.updated !== current.updated) return next.updated > current.updated ? next : current;
  if (next.updatedMatches.length !== current.updatedMatches.length) {
    return next.updatedMatches.length > current.updatedMatches.length ? next : current;
  }
  if (next.matched !== current.matched) return next.matched > current.matched ? next : current;
  return next.received > current.received ? next : current;
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
      source: "Fuera del horario automatico de 07:00 a 00:59 America/Bogota",
    };
  }

  const providers = [
    process.env.FOOTBALL_DATA_API_KEY
      ? { name: "football-data.org", update: updateWorldCupResultsFromFootballData }
      : null,
    process.env.API_FOOTBALL_KEY
      ? { name: "API-Football", update: updateWorldCupResultsFromApiFootball }
      : null,
  ].filter((provider): provider is ResultsProvider => Boolean(provider));

  let result: ResultsProviderResult | null = null;
  const providerErrors: string[] = [];
  const providerAttempts: Array<{
    name: string;
    ok: boolean;
    checked?: number;
    received?: number;
    matched?: number;
    updated?: number;
    updatedMatches?: number;
    source?: string;
    fallbackReason?: string;
    error?: string;
  }> = [];

  for (const provider of providers) {
    try {
      const providerResult = await provider.update();
      const usefulUpdate = hasUsefulProviderUpdate(providerResult);
      result = pickBestProviderResult(result, providerResult);
      providerAttempts.push({
        name: provider.name,
        ok: true,
        checked: providerResult.checked,
        received: providerResult.received,
        matched: providerResult.matched,
        updated: providerResult.updated,
        updatedMatches: providerResult.updatedMatches.length,
        source: providerResult.source,
        fallbackReason: usefulUpdate ? undefined : "Sin actualizaciones utiles; se intenta siguiente proveedor si existe.",
      });

      if (usefulUpdate) break;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      providerErrors.push(`${provider.name}: ${message}`);
      providerAttempts.push({
        name: provider.name,
        ok: false,
        error: message,
        fallbackReason: "Proveedor falló; se intenta siguiente proveedor si existe.",
      });
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
    providerAttempts,
  };
}
