import { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type FootballDataMatch = {
  id?: number;
  utcDate?: string;
  status?: string;
  homeTeam?: { name?: string; shortName?: string };
  awayTeam?: { name?: string; shortName?: string };
  score?: {
    fullTime?: {
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

export async function updateWorldCupResultsFromFootballData() {
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

  const localMatches = await prisma.match.findMany();
  let checked = 0;
  let matched = 0;
  let updated = 0;
  const updatedMatches: Array<{
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    status: MatchStatus;
  }> = [];

  for (const fixture of data.matches) {
    const homeTeam = fixture.homeTeam?.name || fixture.homeTeam?.shortName;
    const awayTeam = fixture.awayTeam?.name || fixture.awayTeam?.shortName;
    const fixtureDate = fixture.utcDate ? new Date(fixture.utcDate) : null;
    const status = statusFromFootballData(fixture.status);
    const homeScore = fixture.score?.fullTime?.home ?? null;
    const awayScore = fixture.score?.fullTime?.away ?? null;

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
      const needsUpdate = match.homeScore !== homeScore || match.awayScore !== awayScore || match.status !== status;
      if (!needsUpdate) continue;

      const updatedMatch = await prisma.match.update({
        where: { id: match.id },
        data: {
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
    received: data.matches.length,
    matched,
    updated,
    updatedMatches,
    source: "football-data.org",
  };
}
