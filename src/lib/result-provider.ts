import type { MatchStatus } from "@prisma/client";

export type ResultProviderName = "football-data.org" | "API-Football";

export type ProviderResultState = {
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
};

export type ProviderResultObservation = {
  provider: ResultProviderName;
  externalFixtureId: string | null;
  globalMatchId: string;
  sourceKey: string | null;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date;
  previous: ProviderResultState & { updatedAt: Date };
  next: ProviderResultState;
};

export type ProviderResultRun = {
  checked: number;
  received: number;
  matched: number;
  observations: ProviderResultObservation[];
  skippedFinished: ProviderResultObservation[];
  source: ResultProviderName;
};

export type ProviderConflict = {
  globalMatchId: string;
  homeTeam: string;
  awayTeam: string;
  observations: ProviderResultObservation[];
};

export type AcceptedProviderResult = {
  observation: ProviderResultObservation;
  providers: ResultProviderName[];
  decision: "providerAgreement" | "singleProvider";
};

function resultSignature(observation: ProviderResultObservation) {
  return `${observation.next.status}:${observation.next.homeScore}:${observation.next.awayScore}`;
}

export function reconcileProviderResults(runs: ProviderResultRun[]) {
  const observationsByMatch = new Map<string, ProviderResultObservation[]>();

  for (const observation of runs.flatMap((run) => run.observations)) {
    const current = observationsByMatch.get(observation.globalMatchId) ?? [];
    current.push(observation);
    observationsByMatch.set(observation.globalMatchId, current);
  }

  const accepted: AcceptedProviderResult[] = [];
  const conflicts: ProviderConflict[] = [];

  for (const observations of observationsByMatch.values()) {
    const providers = [...new Set(observations.map((observation) => observation.provider))];
    const signatures = new Set(observations.map(resultSignature));

    if (signatures.size > 1) {
      conflicts.push({
        globalMatchId: observations[0].globalMatchId,
        homeTeam: observations[0].homeTeam,
        awayTeam: observations[0].awayTeam,
        observations,
      });
      continue;
    }

    accepted.push({
      observation: observations[0],
      providers,
      decision: providers.length > 1 ? "providerAgreement" : "singleProvider",
    });
  }

  return { accepted, conflicts };
}

type ResultDecisionLog = {
  decision:
    | "updated"
    | "skippedFinished"
    | "protectedFinished"
    | "singleProvider"
    | "providerConflict";
  flow: string;
  provider?: string;
  providers?: string[];
  externalFixtureId?: string | null;
  globalMatchId: string;
  roomMatchId?: string;
  homeTeam: string;
  awayTeam: string;
  previous?: ProviderResultState;
  next?: ProviderResultState;
  detail?: string;
};

export function logResultDecision(level: "info" | "warn", data: ResultDecisionLog) {
  const payload = {
    scope: "automatic-results",
    at: new Date().toISOString(),
    ...data,
  };
  const message = JSON.stringify(payload);

  if (level === "warn") {
    console.warn(message);
    return;
  }

  console.info(message);
}
