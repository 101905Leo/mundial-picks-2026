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
  errors?: unknown;
  response?: ApiFootballFixture[];
};

const finalStatuses = new Set(["FT", "AET", "PEN"]);
const liveStatuses = new Set(["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"]);

function normalizeTeam(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function sameUtcDay(left: Date, right: Date) {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

function statusFromApi(shortStatus?: string): MatchStatus | null {
  if (!shortStatus) return null;
  if (finalStatuses.has(shortStatus)) return "FINISHED";
  if (liveStatuses.has(shortStatus)) return "LIVE";
  return null;
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

  const matches = await prisma.match.findMany();
  let updated = 0;
  let checked = 0;

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

    const match = matches.find((item) => {
      if (directSourceKey && item.sourceKey === directSourceKey) return true;
      if (!sameUtcDay(item.startsAt, fixtureDate)) return false;
      return normalizeTeam(item.homeTeam) === homeKey && normalizeTeam(item.awayTeam) === awayKey;
    });

    if (!match) continue;

    const needsUpdate = match.homeScore !== homeScore || match.awayScore !== awayScore || match.status !== status;

    if (!needsUpdate) continue;

    await prisma.match.update({
      where: { id: match.id },
      data: {
        homeScore,
        awayScore,
        status,
      },
    });

    updated += 1;
  }

  return {
    checked,
    updated,
    source: "API-Football",
  };
}
