import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getScoringStatus } from "@/lib/scoring";
import {
  logResultDecision,
  type ProviderResultObservation,
  type ProviderResultRun,
} from "@/lib/result-provider";

type FootballDataMatch = {
  id?: number;
  utcDate?: string;
  status?: string;
  homeTeam?: { name?: string; shortName?: string };
  awayTeam?: { name?: string; shortName?: string };
  score?: {
    regularTime?: {
      home?: number | null;
      away?: number | null;
    };
    fullTime?: {
      home?: number | null;
      away?: number | null;
    };
    halfTime?: {
      home?: number | null;
      away?: number | null;
    };
  };
};

type FootballDataResponse = {
  matches?: FootballDataMatch[];
  message?: string;
  errorCode?: number;
};

type LocalMatch = Awaited<ReturnType<typeof prisma.match.findMany>>[number];
type FootballDataScore = {
  home?: number | null;
  away?: number | null;
};

function normalizeTeam(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  const aliases: Record<string, string> = {
    usa: "unitedstates",
    unitedstatesofamerica: "unitedstates",
    korearepublic: "southkorea",
    republicofkorea: "southkorea",
    iriran: "iran",
  };

  return aliases[normalized] ?? normalized;
}

function closeKickoff(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) <= 18 * 60 * 60 * 1000;
}

function statusFromFootballData(status?: string): MatchStatus | null {
  if (status === "FINISHED") return "FINISHED";
  if (status === "IN_PLAY" || status === "PAUSED") return "LIVE";
  return null;
}

function firstValidScore(...scores: Array<FootballDataScore | undefined>) {
  return scores.find((score) => score?.home !== null && score?.home !== undefined && score?.away !== null && score?.away !== undefined) ?? null;
}

function findMatchingLocalMatches(matches: LocalMatch[], directSourceKey: string | null, fixtureDate: Date, homeKey: string, awayKey: string) {
  const exactSourceMatch = directSourceKey ? matches.find((item) => item.sourceKey === directSourceKey) : null;
  const teamTimeMatches = matches.filter((item) => {
    if (!closeKickoff(item.startsAt, fixtureDate)) return false;
    return normalizeTeam(item.homeTeam) === homeKey && normalizeTeam(item.awayTeam) === awayKey;
  });

  return [
    ...(exactSourceMatch ? [exactSourceMatch] : []),
    ...teamTimeMatches.filter((item) => item.id !== exactSourceMatch?.id),
  ];
}

export async function updateWorldCupResultsFromFootballData(
  options: { flow?: string } = {},
): Promise<ProviderResultRun> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY?.replace(/\s+/g, "").trim();
  const competitionCode = process.env.FOOTBALL_DATA_COMPETITION_CODE || "WC";

  if (!apiKey) {
    throw new Error("Falta configurar FOOTBALL_DATA_API_KEY");
  }

  const response = await fetch(
    `https://api.football-data.org/v4/competitions/${encodeURIComponent(competitionCode)}/matches`,
    {
      cache: "no-store",
      headers: {
        "X-Auth-Token": apiKey,
      },
    },
  );

  const data = (await response.json()) as FootballDataResponse;
  if (!response.ok) {
    throw new Error(data.message || `football-data.org respondio con error ${response.status}`);
  }

  if (!Array.isArray(data.matches)) {
    throw new Error(data.message || "football-data.org no devolvio partidos validos");
  }

  const localMatches = await prisma.match.findMany({ where: { roomId: null } });
  let checked = 0;
  let matched = 0;
  const observations: ProviderResultObservation[] = [];
  const skippedFinished: ProviderResultObservation[] = [];

  for (const fixture of data.matches) {
    const homeTeam = fixture.homeTeam?.name || fixture.homeTeam?.shortName;
    const awayTeam = fixture.awayTeam?.name || fixture.awayTeam?.shortName;
    const fixtureDate = fixture.utcDate ? new Date(fixture.utcDate) : null;
    const currentScore = firstValidScore(fixture.score?.fullTime, fixture.score?.regularTime, fixture.score?.halfTime);
    const homeScore = currentScore?.home ?? null;
    const awayScore = currentScore?.away ?? null;
    const status = statusFromFootballData(fixture.status) ?? (
      fixtureDate && homeScore !== null && awayScore !== null
        ? getScoringStatus({ status: "SCHEDULED", startsAt: fixtureDate, homeScore, awayScore }) as MatchStatus
        : null
    );

    if (!homeTeam || !awayTeam || !fixtureDate || status === null || homeScore === null || awayScore === null) {
      continue;
    }

    checked += 1;

    const directSourceKey = fixture.id ? `football-data-${fixture.id}` : null;
    const homeKey = normalizeTeam(homeTeam);
    const awayKey = normalizeTeam(awayTeam);
    const matchingMatches = findMatchingLocalMatches(localMatches, directSourceKey, fixtureDate, homeKey, awayKey);

    if (!matchingMatches.length) continue;
    matched += matchingMatches.length;

    for (const match of matchingMatches) {
      const observation: ProviderResultObservation = {
        provider: "football-data.org",
        externalFixtureId: fixture.id ? String(fixture.id) : null,
        globalMatchId: match.id,
        sourceKey: match.sourceKey,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        startsAt: match.startsAt,
        previous: {
          status: match.status,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          updatedAt: match.updatedAt,
        },
        next: {
          status,
          homeScore,
          awayScore,
        },
      };
      const differs =
        match.status !== status ||
        match.homeScore !== homeScore ||
        match.awayScore !== awayScore;

      if (match.status === "FINISHED") {
        if (differs) {
          skippedFinished.push(observation);
          logResultDecision("warn", {
            decision: "skippedFinished",
            flow: options.flow ?? "provider/football-data",
            provider: observation.provider,
            externalFixtureId: observation.externalFixtureId,
            globalMatchId: observation.globalMatchId,
            homeTeam: observation.homeTeam,
            awayTeam: observation.awayTeam,
            previous: observation.previous,
            next: observation.next,
            detail: "El global FINISHED no se sobrescribe automaticamente.",
          });
        } else {
          observations.push(observation);
        }
        continue;
      }

      observations.push(observation);
    }
  }

  return {
    checked,
    received: data.matches.length,
    matched,
    observations,
    skippedFinished,
    source: "football-data.org",
  };
}
