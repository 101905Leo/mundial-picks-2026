import { prisma } from "@/lib/prisma";
import { updateWorldCupResultsFromApiFootball } from "@/lib/football-results";
import { updateWorldCupResultsFromFootballData } from "@/lib/football-data-results";
import { recalculateFinishedMatchPoints } from "@/lib/recalculate-points";
import {
  logResultDecision,
  reconcileProviderResults,
  type ProviderResultRun,
} from "@/lib/result-provider";
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

type AutomaticResultsOptions = {
  enforceSchedule?: boolean;
  notify?: boolean;
  flow?: string;
};

function sameResult(
  left: { status: string; homeScore: number | null; awayScore: number | null },
  right: { status: string; homeScore: number | null; awayScore: number | null },
) {
  return (
    left.status === right.status &&
    left.homeScore === right.homeScore &&
    left.awayScore === right.awayScore
  );
}

export async function updateResultsAndRecalculate(options: AutomaticResultsOptions = {}) {
  const flow = options.flow ?? "automatic-results";

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
  ].filter(
    (
      provider,
    ): provider is {
      name: string;
      update: (options?: { flow?: string }) => Promise<ProviderResultRun>;
    } => Boolean(provider),
  );

  const providerRuns: ProviderResultRun[] = [];
  const providerErrors: string[] = [];

  for (const provider of providers) {
    try {
      providerRuns.push(await provider.update({ flow }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      providerErrors.push(`${provider.name}: ${message}`);
    }
  }

  const reconciliation = reconcileProviderResults(providerRuns);
  for (const conflict of reconciliation.conflicts) {
    logResultDecision("warn", {
      decision: "providerConflict",
      flow,
      providers: conflict.observations.map((observation) => observation.provider),
      globalMatchId: conflict.globalMatchId,
      homeTeam: conflict.homeTeam,
      awayTeam: conflict.awayTeam,
      detail: conflict.observations
        .map(
          (observation) =>
            `${observation.provider}:${observation.next.status}:${observation.next.homeScore}-${observation.next.awayScore}`,
        )
        .join(" | "),
    });
  }

  const acceptedGlobalMatchIds = new Set<string>();
  const updatedMatches: Array<{
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    status: "SCHEDULED" | "LIVE" | "FINISHED";
  }> = [];
  const centralSkippedFinished = [];

  for (const accepted of reconciliation.accepted) {
    const observation = accepted.observation;

    if (accepted.decision === "singleProvider") {
      logResultDecision("warn", {
        decision: "singleProvider",
        flow,
        provider: observation.provider,
        externalFixtureId: observation.externalFixtureId,
        globalMatchId: observation.globalMatchId,
        homeTeam: observation.homeTeam,
        awayTeam: observation.awayTeam,
        previous: observation.previous,
        next: observation.next,
        detail: "Resultado aceptado con un solo proveedor disponible para este partido.",
      });
    }

    const current = await prisma.match.findUnique({
      where: { id: observation.globalMatchId },
      select: {
        id: true,
        roomId: true,
        sourceKey: true,
        homeTeam: true,
        awayTeam: true,
        status: true,
        homeScore: true,
        awayScore: true,
      },
    });

    if (!current || current.roomId !== null) {
      logResultDecision("warn", {
        decision: "providerConflict",
        flow,
        providers: accepted.providers,
        globalMatchId: observation.globalMatchId,
        homeTeam: observation.homeTeam,
        awayTeam: observation.awayTeam,
        detail: "El partido global dejo de existir o ya pertenece a una sala.",
      });
      continue;
    }

    if (current.status === "FINISHED") {
      if (sameResult(current, observation.next)) {
        acceptedGlobalMatchIds.add(current.id);
      } else {
        centralSkippedFinished.push(observation);
        logResultDecision("warn", {
          decision: "skippedFinished",
          flow,
          providers: accepted.providers,
          externalFixtureId: observation.externalFixtureId,
          globalMatchId: current.id,
          homeTeam: current.homeTeam,
          awayTeam: current.awayTeam,
          previous: current,
          next: observation.next,
          detail: "Proteccion concurrente: el global FINISHED no se sobrescribe.",
        });
      }
      continue;
    }

    if (sameResult(current, observation.next)) {
      acceptedGlobalMatchIds.add(current.id);
      continue;
    }

    const updated = await prisma.match.updateMany({
      where: {
        id: current.id,
        roomId: null,
        status: current.status,
        homeScore: current.homeScore,
        awayScore: current.awayScore,
      },
      data: observation.next,
    });

    if (updated.count !== 1) {
      logResultDecision("warn", {
        decision: "providerConflict",
        flow,
        providers: accepted.providers,
        externalFixtureId: observation.externalFixtureId,
        globalMatchId: current.id,
        homeTeam: current.homeTeam,
        awayTeam: current.awayTeam,
        previous: current,
        next: observation.next,
        detail: "Cambio concurrente detectado; no se aplico la observacion.",
      });
      continue;
    }

    acceptedGlobalMatchIds.add(current.id);
    updatedMatches.push({
      id: current.id,
      homeTeam: current.homeTeam,
      awayTeam: current.awayTeam,
      homeScore: observation.next.homeScore!,
      awayScore: observation.next.awayScore!,
      status: observation.next.status,
    });
    logResultDecision("info", {
      decision: "updated",
      flow,
      providers: accepted.providers,
      externalFixtureId: observation.externalFixtureId,
      globalMatchId: current.id,
      homeTeam: current.homeTeam,
      awayTeam: current.awayTeam,
      previous: current,
      next: observation.next,
    });
  }

  const checked = providerRuns.reduce((sum, run) => sum + run.checked, 0);
  const received = providerRuns.reduce((sum, run) => sum + run.received, 0);
  const matched = providerRuns.reduce((sum, run) => sum + run.matched, 0);
  const source =
    providerRuns.length > 0
      ? providerRuns.map((run) => run.source).join(" + ")
      : providers.length > 0
        ? `Proveedor externo sin actualizacion: ${providerErrors.join(" | ")}`
        : "Sin proveedor de resultados configurado";

  const roomSync = await syncRoomResultsFromGlobal({
    globalMatchIds: [...acceptedGlobalMatchIds],
    flow,
  });
  const roomMatchesSynced = roomSync.updated;
  const predictionsUpdated =
    roomMatchesSynced > 0 ? await recalculateFinishedMatchPoints() : 0;

  if (options.notify !== false && (updatedMatches.length > 0 || roomMatchesSynced > 0)) {
    const scoreLines = updatedMatches
      .slice(0, 8)
      .map((match) => `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`)
      .join("\n");
    const extraMatches =
      updatedMatches.length > 8
        ? `\nY ${updatedMatches.length - 8} resultado(s) mas.`
        : "";

    await notifyWhatsAppUsers(
      `Mundial Picks Arena: resultados actualizados.\n${scoreLines || "Salas sincronizadas con resultados existentes."}${extraMatches}\nPartidos de sala sincronizados: ${roomMatchesSynced}.\nPicks recalculados: ${predictionsUpdated}.`,
    );
  }

  return {
    checked,
    received,
    matched,
    updated: updatedMatches.length,
    updatedMatches,
    roomMatchesSynced,
    roomMatchesMatched: roomSync.matched,
    roomMatchesAlreadySynced: roomSync.alreadySynced,
    predictionsUpdated,
    providerErrors,
    providerConflicts: reconciliation.conflicts,
    singleProvider: reconciliation.accepted.filter(
      (accepted) => accepted.decision === "singleProvider",
    ).length,
    skippedFinished: [
      ...providerRuns.flatMap((run) => run.skippedFinished),
      ...centralSkippedFinished,
    ],
    protectedFinished: roomSync.protectedFinished,
    source,
  };
}
