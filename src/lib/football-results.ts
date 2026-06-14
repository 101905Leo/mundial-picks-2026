import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ApiFootballFixture = {
  fixture?: {
    id?: number;
    date?: string;
    status?: {
      short?: string;
    };
  };
  teams?: {
    home?: { name?: string };
    away?: { name?: string };
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
  score?: {
    fulltime?: {
      home?: number | null;
      away?: number | null;
    };
  };
};

type ApiFootballResponse = {
  errors?: Record<string, string> | string[];
  response?: ApiFootballFixture[];
};

type LocalMatch = Awaited<ReturnType<typeof prisma.match.findMany>>[number];

const finalStatuses = new Set(["FT", "AET", "PEN"]);
const liveStatuses = new Set(["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"]);

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

function statusFromApi(shortStatus?: string): MatchStatus | null {
  if (!shortStatus) return null;
  if (finalStatuses.has(shortStatus)) return "FINISHED";
  if (liveStatuses.has(shortStatus)) return "LIVE";
  return null;
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

function canAssignSourceKey(matches: LocalMatch[], match: LocalMatch, directSourceKey: string | null, matchingCount: number) {
  if (!directSourceKey || match.sourceKey === directSourceKey) return false;
  if (matchingCount > 1) return false;

  const owner = matches.find((item) => item.sourceKey === directSourceKey);
  return !owner || owner.id === match.id;
}

export async function updateWorldCupResultsFromApiFootball() {
  const apiKey = process.env.API_FOOTBALL_KEY;
  const leagueId = process.env.API_FOOTBALL_LEAGUE_ID || "1";
  const season = process.env.API_FOOTBALL_SEASON || "2026";

  if (!apiKey) {
    throw new Error("Falta configurar API_FOOTBALL_KEY en el archivo .env");
  }

  const url = new URL("https://v3.football.api-sports.io/fixtures");
  url.searchParams.set("league", leagueId);
  url.searchParams.set("season", season);

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "x-apisports-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`La API de resultados respondio con error ${response.status}`);
  }

  const data = (await response.json()) as ApiFootballResponse;

  if (!Array.isArray(data.response)) {
    throw new Error("La API de resultados no devolvio partidos validos");
  }
  if (data.errors && Object.keys(data.errors).length > 0) {
    const serializedErrors = JSON.stringify(data.errors);
    if (serializedErrors.includes("Free plans do not have access to this season")) {
      throw new Error(
        "API-Football no permite consultar la temporada 2026 con el plan gratuito. El horario no cambia esta restriccion: debes activar un plan con acceso a 2026 o configurar otro proveedor de resultados.",
      );
    }
    throw new Error(`API-Football reporto: ${serializedErrors}`);
  }

  const matches = await prisma.match.findMany();
  let updated = 0;
  let checked = 0;
  let matched = 0;
  const updatedMatches: Array<{
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    status: MatchStatus;
  }> = [];

  for (const fixture of data.response) {
    const homeTeam = fixture.teams?.home?.name;
    const awayTeam = fixture.teams?.away?.name;
    const fixtureDate = fixture.fixture?.date ? new Date(fixture.fixture.date) : null;
    const status = statusFromApi(fixture.fixture?.status?.short);
    const homeScore = fixture.goals?.home ?? fixture.score?.fulltime?.home ?? null;
    const awayScore = fixture.goals?.away ?? fixture.score?.fulltime?.away ?? null;

    if (!homeTeam || !awayTeam || !fixtureDate || status === null || homeScore === null || awayScore === null) {
      continue;
    }

    checked += 1;

    const directSourceKey = fixture.fixture?.id ? `api-football-${fixture.fixture.id}` : null;
    const homeKey = normalizeTeam(homeTeam);
    const awayKey = normalizeTeam(awayTeam);

    const matchingMatches = findMatchingLocalMatches(matches, directSourceKey, fixtureDate, homeKey, awayKey);

    if (!matchingMatches.length) continue;
    matched += matchingMatches.length;

    for (const match of matchingMatches) {
      const needsUpdate = match.homeScore !== homeScore || match.awayScore !== awayScore || match.status !== status;
      const shouldAssignSourceKey = canAssignSourceKey(matches, match, directSourceKey, matchingMatches.length);
      const needsSourceKey = shouldAssignSourceKey;

      if (!needsUpdate && !needsSourceKey) continue;

      const updatedMatch = await prisma.match.update({
        where: { id: match.id },
        data: {
          ...(shouldAssignSourceKey && directSourceKey ? { sourceKey: directSourceKey } : {}),
          homeScore,
          awayScore,
          status,
        },
        select: {
          id: true,
          homeTeam: true,
          awayTeam: true,
          homeScore: true,
          awayScore: true,
          status: true,
        },
      });

      if (needsUpdate) updated += 1;
      if (needsUpdate && updatedMatch.homeScore !== null && updatedMatch.awayScore !== null) {
        updatedMatches.push({
          id: updatedMatch.id,
          homeTeam: updatedMatch.homeTeam,
          awayTeam: updatedMatch.awayTeam,
          homeScore: updatedMatch.homeScore,
          awayScore: updatedMatch.awayScore,
          status: updatedMatch.status,
        });
      }
    }
  }

  return {
    checked,
    received: data.response.length,
    matched,
    updated,
    updatedMatches,
    source: "API-Football",
  };
}
