import { existsSync, readFileSync } from "node:fs";
import { PrismaClient, type MatchStatus } from "@prisma/client";
import { normalizeTeamName, sameMatchByTeamsAndKickoff } from "../src/lib/match-equivalence";

const prisma = new PrismaClient();

const roomId = "cmqso1l7r0001js04zd47vbbs";
const roomInviteCode = "MP30MA48";
const roomMatchId = "cmqso2dox005bl2040bp1ne50";
const globalMatchId = "cmq7kkpet002hjp046isf9gff";
const targetHomeTeam = "Canada";
const targetAwayTeam = "Morocco";

type MatchSnapshot = {
  id: string;
  sourceKey: string | null;
  homeTeam: string;
  awayTeam: string;
  group: string | null;
  startsAt: Date;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  isPublished: boolean;
  competitionId: string | null;
  roomId: string | null;
  updatedAt: Date;
  _count: { predictions: number };
};

type ProviderFixture = {
  provider: "football-data.org" | "API-Football";
  externalFixtureId: string | null;
  directSourceKey: string | null;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date;
  status: MatchStatus | null;
  homeScore: number | null;
  awayScore: number | null;
  rawStatus: string | null;
};

const matchSelect = {
  id: true,
  sourceKey: true,
  homeTeam: true,
  awayTeam: true,
  group: true,
  startsAt: true,
  status: true,
  homeScore: true,
  awayScore: true,
  isPublished: true,
  competitionId: true,
  roomId: true,
  updatedAt: true,
  _count: { select: { predictions: true } },
} as const;

function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
  }
}

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

function scoreLabel(match: Pick<MatchSnapshot | ProviderFixture, "homeScore" | "awayScore">) {
  if (match.homeScore === null || match.awayScore === null) return "-";
  return `${match.homeScore}-${match.awayScore}`;
}

function matchLabel(match: Pick<MatchSnapshot | ProviderFixture, "homeTeam" | "awayTeam">) {
  return `${match.homeTeam} vs ${match.awayTeam}`;
}

function closeKickoff(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) <= 18 * 60 * 60 * 1000;
}

function closeTargetKickoff(value: Date, target: Date) {
  return Math.abs(value.getTime() - target.getTime()) <= 2 * 60 * 60 * 1000;
}

function statusFromFootballData(status?: string): MatchStatus | null {
  if (status === "FINISHED") return "FINISHED";
  if (status === "IN_PLAY" || status === "PAUSED") return "LIVE";
  return null;
}

function statusFromApiFootball(status?: string): MatchStatus | null {
  if (!status) return null;
  if (["FT", "AET", "PEN"].includes(status)) return "FINISHED";
  if (["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(status)) {
    return "LIVE";
  }
  return null;
}

function firstCompleteScore(
  ...scores: Array<{ home?: number | null; away?: number | null } | undefined>
) {
  return (
    scores.find(
      (score) =>
        score?.home !== null &&
        score?.home !== undefined &&
        score?.away !== null &&
        score?.away !== undefined,
    ) ?? null
  );
}

function sameTeams(homeTeam: string, awayTeam: string, fixture: ProviderFixture) {
  return (
    normalizeTeamName(fixture.homeTeam) === normalizeTeamName(homeTeam) &&
    normalizeTeamName(fixture.awayTeam) === normalizeTeamName(awayTeam)
  );
}

function isPlaceholderTeam(team: string) {
  return /^(?:W|L)\d+$/i.test(team.trim()) ||
    /^(?:TBD|TBC|Winner|Ganador)(?:\s|$)/i.test(team.trim()) ||
    /^\d+[A-L](?:\/|$)/i.test(team.trim());
}

async function fetchFootballDataFixtures(targetStartsAt: Date): Promise<ProviderFixture[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY?.replace(/\s+/g, "").trim();
  if (!apiKey) return [];

  const competitionCode = process.env.FOOTBALL_DATA_COMPETITION_CODE || "WC";
  const response = await fetch(
    `https://api.football-data.org/v4/competitions/${encodeURIComponent(competitionCode)}/matches`,
    {
      cache: "no-store",
      headers: { "X-Auth-Token": apiKey },
    },
  );
  const data = (await response.json()) as {
    matches?: Array<{
      id?: number;
      utcDate?: string;
      status?: string;
      homeTeam?: { name?: string; shortName?: string };
      awayTeam?: { name?: string; shortName?: string };
      score?: {
        regularTime?: { home?: number | null; away?: number | null };
        fullTime?: { home?: number | null; away?: number | null };
        halfTime?: { home?: number | null; away?: number | null };
      };
    }>;
    message?: string;
  };
  if (!response.ok || !Array.isArray(data.matches)) {
    throw new Error(data.message || `football-data.org respondio ${response.status}`);
  }

  return data.matches
    .flatMap((fixture): ProviderFixture[] => {
      const homeTeam = fixture.homeTeam?.name || fixture.homeTeam?.shortName;
      const awayTeam = fixture.awayTeam?.name || fixture.awayTeam?.shortName;
      const startsAt = fixture.utcDate ? new Date(fixture.utcDate) : null;
      if (!homeTeam || !awayTeam || !startsAt || Number.isNaN(startsAt.getTime())) return [];
      const score = firstCompleteScore(
        fixture.score?.fullTime,
        fixture.score?.regularTime,
        fixture.score?.halfTime,
      );
      return [
        {
          provider: "football-data.org",
          externalFixtureId: fixture.id ? String(fixture.id) : null,
          directSourceKey: fixture.id ? `football-data-${fixture.id}` : null,
          homeTeam,
          awayTeam,
          startsAt,
          status: statusFromFootballData(fixture.status),
          homeScore: score?.home ?? null,
          awayScore: score?.away ?? null,
          rawStatus: fixture.status ?? null,
        },
      ];
    })
    .filter(
      (fixture) =>
        closeTargetKickoff(fixture.startsAt, targetStartsAt) ||
        sameTeams(targetHomeTeam, targetAwayTeam, fixture),
    );
}

async function fetchApiFootballFixtures(targetStartsAt: Date): Promise<ProviderFixture[]> {
  const apiKey = process.env.API_FOOTBALL_KEY?.trim();
  if (!apiKey) return [];

  const url = new URL("https://v3.football.api-sports.io/fixtures");
  url.searchParams.set("league", process.env.API_FOOTBALL_LEAGUE_ID || "1");
  url.searchParams.set("season", process.env.API_FOOTBALL_SEASON || "2026");

  const response = await fetch(url, {
    cache: "no-store",
    headers: { "x-apisports-key": apiKey },
  });
  const data = (await response.json()) as {
    errors?: Record<string, string> | string[];
    response?: Array<{
      fixture?: { id?: number; date?: string; status?: { short?: string } };
      teams?: { home?: { name?: string }; away?: { name?: string } };
      goals?: { home?: number | null; away?: number | null };
      score?: { fulltime?: { home?: number | null; away?: number | null } };
    }>;
  };
  if (!response.ok || !Array.isArray(data.response)) {
    throw new Error(`API-Football respondio ${response.status}`);
  }
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football reporto errores: ${JSON.stringify(data.errors)}`);
  }

  return data.response
    .flatMap((fixture): ProviderFixture[] => {
      const homeTeam = fixture.teams?.home?.name;
      const awayTeam = fixture.teams?.away?.name;
      const startsAt = fixture.fixture?.date ? new Date(fixture.fixture.date) : null;
      if (!homeTeam || !awayTeam || !startsAt || Number.isNaN(startsAt.getTime())) return [];
      return [
        {
          provider: "API-Football",
          externalFixtureId: fixture.fixture?.id ? String(fixture.fixture.id) : null,
          directSourceKey: fixture.fixture?.id ? `api-football-${fixture.fixture.id}` : null,
          homeTeam,
          awayTeam,
          startsAt,
          status: statusFromApiFootball(fixture.fixture?.status?.short),
          homeScore: fixture.goals?.home ?? fixture.score?.fulltime?.home ?? null,
          awayScore: fixture.goals?.away ?? fixture.score?.fulltime?.away ?? null,
          rawStatus: fixture.fixture?.status?.short ?? null,
        },
      ];
    })
    .filter(
      (fixture) =>
        closeTargetKickoff(fixture.startsAt, targetStartsAt) ||
        sameTeams(targetHomeTeam, targetAwayTeam, fixture),
    );
}

function providerMappingRows(fixtures: ProviderFixture[], globalMatch: MatchSnapshot) {
  return fixtures.map((fixture) => {
    const directSourceMatch = Boolean(fixture.directSourceKey && fixture.directSourceKey === globalMatch.sourceKey);
    const teamTimeMatch =
      closeKickoff(fixture.startsAt, globalMatch.startsAt) &&
      normalizeTeamName(fixture.homeTeam) === normalizeTeamName(globalMatch.homeTeam) &&
      normalizeTeamName(fixture.awayTeam) === normalizeTeamName(globalMatch.awayTeam);
    const uniqueKickoffFallback =
      closeKickoff(fixture.startsAt, globalMatch.startsAt) &&
      isPlaceholderTeam(globalMatch.homeTeam) &&
      isPlaceholderTeam(globalMatch.awayTeam);

    return {
      provider: fixture.provider,
      externalFixtureId: fixture.externalFixtureId,
      partidoProveedor: matchLabel(fixture),
      status: fixture.status ?? fixture.rawStatus ?? "-",
      marcador: scoreLabel(fixture),
      startsAt: fixture.startsAt.toISOString(),
      directSourceKey: fixture.directSourceKey,
      sourceKeyCoincide: directSourceMatch,
      equipoHoraCoincide: teamTimeMatch,
      fallbackUnicoPorHoraPosible: uniqueKickoffFallback,
      actualizariaHoy: directSourceMatch || teamTimeMatch,
    };
  });
}

async function main() {
  loadEnvFiles();

  const [room, roomMatch, globalMatch] = await Promise.all([
    prisma.league.findUnique({
      where: { id: roomId },
      select: { id: true, name: true, inviteCode: true, competitionId: true },
    }),
    prisma.match.findUnique({ where: { id: roomMatchId }, select: matchSelect }),
    prisma.match.findUnique({ where: { id: globalMatchId }, select: matchSelect }),
  ]);

  if (!room) throw new Error(`No se encontro la sala ${roomId}.`);
  if (room.inviteCode !== roomInviteCode) {
    throw new Error(`La sala ${roomId} no tiene inviteCode ${roomInviteCode}.`);
  }
  if (!roomMatch) throw new Error(`No se encontro el partido de sala ${roomMatchId}.`);
  if (!globalMatch) throw new Error(`No se encontro el partido global ${globalMatchId}.`);

  const [globalCandidatesAtKickoff, roomCandidatesAtKickoff] = await Promise.all([
    prisma.match.findMany({
      where: {
        roomId: null,
        competitionId: roomMatch.competitionId,
        group: roomMatch.group,
        startsAt: roomMatch.startsAt,
      },
      select: matchSelect,
      orderBy: { createdAt: "asc" },
    }),
    prisma.match.findMany({
      where: {
        roomId,
        group: roomMatch.group,
        startsAt: roomMatch.startsAt,
      },
      select: matchSelect,
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const envStatus = {
    DATABASE_URL: hasValue(process.env.DATABASE_URL),
    FOOTBALL_DATA_API_KEY: hasValue(process.env.FOOTBALL_DATA_API_KEY),
    FOOTBALL_DATA_COMPETITION_CODE: hasValue(process.env.FOOTBALL_DATA_COMPETITION_CODE),
    API_FOOTBALL_KEY: hasValue(process.env.API_FOOTBALL_KEY),
    API_FOOTBALL_LEAGUE_ID: hasValue(process.env.API_FOOTBALL_LEAGUE_ID),
    API_FOOTBALL_SEASON: hasValue(process.env.API_FOOTBALL_SEASON),
    CRON_SECRET: hasValue(process.env.CRON_SECRET),
  };

  const providerFixtures: ProviderFixture[] = [];
  const providerErrors: string[] = [];

  for (const fetchProviderFixtures of [fetchFootballDataFixtures, fetchApiFootballFixtures]) {
    try {
      providerFixtures.push(...(await fetchProviderFixtures(roomMatch.startsAt)));
    } catch (error) {
      providerErrors.push(error instanceof Error ? error.message : "Error desconocido");
    }
  }

  const syncEquivalent = sameMatchByTeamsAndKickoff(globalMatch, roomMatch);
  const globalHasPlaceholder = isPlaceholderTeam(globalMatch.homeTeam) || isPlaceholderTeam(globalMatch.awayTeam);
  const providerRows = providerMappingRows(providerFixtures, globalMatch);
  const currentProviderCanUpdateGlobal = providerRows.some((row) => row.actualizariaHoy);
  const fallbackCouldMap = providerRows.some((row) => row.fallbackUnicoPorHoraPosible) &&
    globalCandidatesAtKickoff.length === 1;

  console.log(`Sala: ${room.name} (${room.inviteCode})`);
  console.log("\nVariables presentes (boolean, sin secretos):");
  console.table([envStatus]);

  console.log("\nPartido de sala Canada vs Morocco:");
  console.table([
    {
      id: roomMatch.id,
      sourceKey: roomMatch.sourceKey,
      partido: matchLabel(roomMatch),
      group: roomMatch.group,
      startsAt: roomMatch.startsAt.toISOString(),
      status: roomMatch.status,
      marcador: scoreLabel(roomMatch),
      publicado: roomMatch.isPublished,
      predictions: roomMatch._count.predictions,
      competitionId: roomMatch.competitionId,
    },
  ]);

  console.log("\nPartido global canonico esperado:");
  console.table([
    {
      id: globalMatch.id,
      sourceKey: globalMatch.sourceKey,
      partido: matchLabel(globalMatch),
      group: globalMatch.group,
      startsAt: globalMatch.startsAt.toISOString(),
      status: globalMatch.status,
      marcador: scoreLabel(globalMatch),
      publicado: globalMatch.isPublished,
      predictions: globalMatch._count.predictions,
      competitionId: globalMatch.competitionId,
      placeholder: globalHasPlaceholder,
    },
  ]);

  console.log("\nCandidatos globales en mismo kickoff/grupo/competencia:");
  console.table(
    globalCandidatesAtKickoff.map((match) => ({
      id: match.id,
      sourceKey: match.sourceKey,
      partido: matchLabel(match),
      status: match.status,
      marcador: scoreLabel(match),
      placeholder: isPlaceholderTeam(match.homeTeam) || isPlaceholderTeam(match.awayTeam),
    })),
  );

  console.log("\nCandidatos de sala en mismo kickoff/grupo:");
  console.table(
    roomCandidatesAtKickoff.map((match) => ({
      id: match.id,
      sourceKey: match.sourceKey,
      partido: matchLabel(match),
      status: match.status,
      marcador: scoreLabel(match),
      predictions: match._count.predictions,
    })),
  );

  console.log("\nResultado del mapeo actual:");
  console.table([
    {
      syncGlobalSalaPorEquiposYHora: syncEquivalent,
      proveedorPuedeActualizarGlobalHoy: currentProviderCanUpdateGlobal,
      fallbackUnicoPorHoraSeriaPosible: fallbackCouldMap,
      sourceKeySalaEsNull: roomMatch.sourceKey === null,
      sourceKeyGlobalOpenFootball: globalMatch.sourceKey?.startsWith("openfootball-worldcup-2026") ?? false,
      razon:
        syncEquivalent && currentProviderCanUpdateGlobal
          ? "MAPEABLE"
          : "NO_MAPEABLE_CON_LOGICA_ACTUAL",
    },
  ]);

  console.log("\nFixtures cercanos devueltos por proveedores configurados:");
  if (providerRows.length) {
    console.table(providerRows);
  } else {
    console.log("No se consulto ningun proveedor o no devolvio fixtures cercanos.");
  }

  if (providerErrors.length) {
    console.log("\nErrores de proveedor:");
    for (const error of providerErrors) console.log(`- ${error}`);
  }

  console.log("\nDiagnostico:");
  if (!currentProviderCanUpdateGlobal) {
    console.log(
      "- El proveedor no puede actualizar el global canonico con la logica actual: " +
        "el sourceKey externo no coincide y el global conserva placeholders.",
    );
  }
  if (!syncEquivalent) {
    console.log(
      "- La sala no puede sincronizar desde ese global con la logica actual: " +
        "sync-room-results compara equipos y kickoff, y W73 vs W75 no equivale a Canada vs Morocco.",
    );
  }
  if (fallbackCouldMap) {
    console.log(
      "- Hay una salida segura posible: fallback estricto por unico partido global en mismo kickoff/grupo/competencia.",
    );
  }
  if (roomMatch.status === "FINISHED") {
    console.log("- La sala esta FINISHED; no debe sobrescribirse desde global.");
  }
  if (globalMatch.status === "FINISHED") {
    console.log("- El global esta FINISHED; no debe degradarse ni sobrescribirse automaticamente.");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
