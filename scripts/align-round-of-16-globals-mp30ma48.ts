import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { sameMatchByTeamsAndKickoff } from "../src/lib/match-equivalence";

const prisma = new PrismaClient();

const roomInviteCode = "MP30MA48";
const roomName = "16avos Mundial 2026";
const competitionId = "competition-world-cup-2026";
const applyToken = "YES";

const matchPairs = [
  {
    sourceKey: "openfootball-worldcup-2026-090-w73-w75",
    roomMatchId: "cmqso2dox005bl2040bp1ne50",
    expectedHomeTeam: "Canada",
    expectedAwayTeam: "Morocco",
  },
  {
    sourceKey: "openfootball-worldcup-2026-089-w74-w77",
    roomMatchId: "cmqso2doz005dl2041oin7vqy",
    expectedHomeTeam: "Paraguay",
    expectedAwayTeam: "France",
  },
  {
    sourceKey: "openfootball-worldcup-2026-091-w76-w78",
    roomMatchId: "cmqso2dp1005fl204zcukwz57",
    expectedHomeTeam: "Brazil",
    expectedAwayTeam: "Norway",
  },
  {
    sourceKey: "openfootball-worldcup-2026-092-w79-w80",
    roomMatchId: "cmqso2dp4005hl204ih3kwm2e",
    expectedHomeTeam: "Mexico",
    expectedAwayTeam: "England",
  },
  {
    sourceKey: "openfootball-worldcup-2026-093-w83-w84",
    roomMatchId: "cmqso2dp6005jl20493du1fny",
    expectedHomeTeam: "Portugal",
    expectedAwayTeam: "Spain",
  },
  {
    sourceKey: "openfootball-worldcup-2026-094-w81-w82",
    roomMatchId: "cmqso2dp8005ll2042gnv4rn4",
    expectedHomeTeam: "USA",
    expectedAwayTeam: "Belgium",
  },
  {
    sourceKey: "openfootball-worldcup-2026-095-w86-w88",
    roomMatchId: "cmqso2dpa005nl2045iuodsmm",
    expectedHomeTeam: "Argentina",
    expectedAwayTeam: "Egypt",
  },
  {
    sourceKey: "openfootball-worldcup-2026-096-w85-w87",
    roomMatchId: "cmqso2dpd005pl204zpjosz18",
    expectedHomeTeam: "Switzerland",
    expectedAwayTeam: "Colombia",
  },
] as const;

type MatchSnapshot = {
  id: string;
  sourceKey: string | null;
  homeTeam: string;
  awayTeam: string;
  group: string | null;
  startsAt: Date;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  isPublished: boolean;
  homeScore: number | null;
  awayScore: number | null;
  competitionId: string | null;
  roomId: string | null;
  updatedAt: Date;
  _count: { predictions: number };
};

type PlannedChange = {
  sourceKey: string;
  globalMatch: MatchSnapshot;
  roomMatch: MatchSnapshot;
  homeTeam: string;
  awayTeam: string;
};

const matchSelect = {
  id: true,
  sourceKey: true,
  homeTeam: true,
  awayTeam: true,
  group: true,
  startsAt: true,
  status: true,
  isPublished: true,
  homeScore: true,
  awayScore: true,
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

function scoreLabel(match: Pick<MatchSnapshot, "homeScore" | "awayScore">) {
  if (match.homeScore === null || match.awayScore === null) return "-";
  return `${match.homeScore}-${match.awayScore}`;
}

function matchLabel(match: Pick<MatchSnapshot, "homeTeam" | "awayTeam">) {
  return `${match.homeTeam} vs ${match.awayTeam}`;
}

function isPlaceholderTeam(team: string) {
  const value = team.trim();
  return /^(?:W|L)\d+$/i.test(value) ||
    /^(?:TBD|TBC|Winner|Ganador)(?:\s|$)/i.test(value) ||
    /^\d+[A-L](?:\/|$)/i.test(value);
}

function teamsMatch(
  match: Pick<MatchSnapshot, "homeTeam" | "awayTeam">,
  homeTeam: string,
  awayTeam: string,
) {
  return match.homeTeam === homeTeam && match.awayTeam === awayTeam;
}

function pushIf(condition: boolean, list: string[], message: string) {
  if (condition) list.push(message);
}

async function auditFinalState(plannedChanges: PlannedChange[]) {
  const globals = await prisma.match.findMany({
    where: { sourceKey: { in: matchPairs.map((pair) => pair.sourceKey) } },
    select: matchSelect,
  });
  const globalsBySourceKey = new Map(globals.map((match) => [match.sourceKey, match]));
  const problems: string[] = [];

  for (const change of plannedChanges) {
    const globalMatch = globalsBySourceKey.get(change.sourceKey);
    if (!globalMatch) {
      problems.push(`${change.sourceKey}: global no encontrado despues del apply.`);
      continue;
    }
    if (!teamsMatch(globalMatch, change.homeTeam, change.awayTeam)) {
      problems.push(`${change.sourceKey}: equipos globales no quedaron alineados.`);
    }
    if (!sameMatchByTeamsAndKickoff(globalMatch, change.roomMatch)) {
      problems.push(`${change.sourceKey}: global y sala no equivalen por equipos + startsAt.`);
    }
    if (globalMatch.status !== "SCHEDULED") problems.push(`${change.sourceKey}: status fue modificado.`);
    if (globalMatch.homeScore !== null || globalMatch.awayScore !== null) {
      problems.push(`${change.sourceKey}: marcador fue modificado.`);
    }
    if (globalMatch.isPublished !== change.globalMatch.isPublished) {
      problems.push(`${change.sourceKey}: isPublished fue modificado.`);
    }
    if (globalMatch._count.predictions !== 0) {
      problems.push(`${change.sourceKey}: tiene predictions despues del apply.`);
    }
  }

  console.log("\nAuditoria posterior:");
  console.table(
    globals.map((match) => ({
      sourceKey: match.sourceKey,
      id: match.id,
      partido: matchLabel(match),
      startsAt: match.startsAt.toISOString(),
      status: match.status,
      marcador: scoreLabel(match),
      publicado: match.isPublished,
      predictions: match._count.predictions,
    })),
  );

  if (problems.length) {
    throw new Error(`Auditoria posterior fallida:\n- ${problems.join("\n- ")}`);
  }
  console.log("Auditoria posterior aprobada: globales alineados por equipos + startsAt.");
}

async function main() {
  loadEnvFiles();

  const wantsApply = process.argv.includes("--apply");
  const hasApplyToken = process.env.APPLY_ALIGN_R16_GLOBALS_MP30MA48 === applyToken;

  if (wantsApply !== hasApplyToken) {
    throw new Error(
      "Aplicacion bloqueada: --apply y APPLY_ALIGN_R16_GLOBALS_MP30MA48=YES deben estar presentes juntos.",
    );
  }

  if (
    matchPairs.length !== 8 ||
    new Set(matchPairs.map((pair) => pair.sourceKey)).size !== 8 ||
    new Set(matchPairs.map((pair) => pair.roomMatchId)).size !== 8
  ) {
    throw new Error("El plan debe contener exactamente 8 sourceKeys y 8 partidos de sala unicos.");
  }

  const room = await prisma.league.findUnique({
    where: { inviteCode: roomInviteCode },
    select: { id: true, name: true, inviteCode: true, competitionId: true },
  });
  if (
    !room ||
    room.name !== roomName ||
    room.inviteCode !== roomInviteCode ||
    room.competitionId !== competitionId
  ) {
    throw new Error(`No se encontro exactamente la sala ${roomName} (${roomInviteCode}).`);
  }

  const [roomMatches, globalMatches, allRoomRoundOf16] = await Promise.all([
    prisma.match.findMany({
      where: { id: { in: matchPairs.map((pair) => pair.roomMatchId) } },
      select: matchSelect,
    }),
    prisma.match.findMany({
      where: { sourceKey: { in: matchPairs.map((pair) => pair.sourceKey) } },
      select: matchSelect,
    }),
    prisma.match.findMany({
      where: { roomId: room.id, group: "Round of 16" },
      select: matchSelect,
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const roomById = new Map(roomMatches.map((match) => [match.id, match]));
  const globalBySourceKey = new Map(globalMatches.map((match) => [match.sourceKey, match]));
  const criticalIssues: string[] = [];
  const warnings: string[] = [];
  const plannedChanges: PlannedChange[] = [];

  if (allRoomRoundOf16.length !== 8) {
    warnings.push(`La sala tiene ${allRoomRoundOf16.length} partidos Round of 16; se esperaban 8.`);
  }

  const planRows = matchPairs.map((pair) => {
    const roomMatch = roomById.get(pair.roomMatchId);
    const globalMatch = globalBySourceKey.get(pair.sourceKey);

    if (!roomMatch) {
      criticalIssues.push(`${pair.roomMatchId}: partido de sala no encontrado.`);
    }
    if (!globalMatch) {
      criticalIssues.push(`${pair.sourceKey}: global no encontrado.`);
    }

    if (roomMatch) {
      pushIf(roomMatch.roomId !== room.id, criticalIssues, `${roomMatch.id}: pertenece a otra sala.`);
      pushIf(roomMatch.group !== "Round of 16", criticalIssues, `${roomMatch.id}: grupo incorrecto.`);
      pushIf(
        roomMatch.competitionId !== competitionId,
        criticalIssues,
        `${roomMatch.id}: competitionId incorrecto.`,
      );
      pushIf(
        !teamsMatch(roomMatch, pair.expectedHomeTeam, pair.expectedAwayTeam),
        criticalIssues,
        `${roomMatch.id}: sala no tiene los equipos esperados ${pair.expectedHomeTeam} vs ${pair.expectedAwayTeam}.`,
      );
    }

    let action = "SIN_CAMBIO";
    if (globalMatch) {
      const globalHasExpectedTeams = teamsMatch(
        globalMatch,
        pair.expectedHomeTeam,
        pair.expectedAwayTeam,
      );
      const globalHasPlaceholder =
        isPlaceholderTeam(globalMatch.homeTeam) || isPlaceholderTeam(globalMatch.awayTeam);

      pushIf(globalMatch.roomId !== null, criticalIssues, `${pair.sourceKey}: global tiene roomId.`);
      pushIf(globalMatch.group !== "Round of 16", criticalIssues, `${pair.sourceKey}: grupo incorrecto.`);
      pushIf(globalMatch.status !== "SCHEDULED", criticalIssues, `${pair.sourceKey}: no esta SCHEDULED.`);
      pushIf(globalMatch.homeScore !== null, criticalIssues, `${pair.sourceKey}: homeScore no es null.`);
      pushIf(globalMatch.awayScore !== null, criticalIssues, `${pair.sourceKey}: awayScore no es null.`);
      pushIf(globalMatch._count.predictions !== 0, criticalIssues, `${pair.sourceKey}: tiene predictions.`);
      pushIf(
        globalMatch.competitionId !== competitionId,
        criticalIssues,
        `${pair.sourceKey}: competitionId incorrecto.`,
      );
      if (roomMatch && globalMatch.startsAt.getTime() !== roomMatch.startsAt.getTime()) {
        criticalIssues.push(`${pair.sourceKey}: startsAt global no coincide con la sala.`);
      }

      if (globalHasExpectedTeams) {
        action = "SIN_CAMBIO";
      } else if (globalHasPlaceholder) {
        action = "ACTUALIZAR_EQUIPOS";
        if (roomMatch) {
          plannedChanges.push({
            sourceKey: pair.sourceKey,
            globalMatch,
            roomMatch,
            homeTeam: pair.expectedHomeTeam,
            awayTeam: pair.expectedAwayTeam,
          });
        }
      } else {
        action = "BLOQUEADO_NO_PLACEHOLDER";
        criticalIssues.push(
          `${pair.sourceKey}: global tiene equipos reales distintos; no se sobrescribe automaticamente.`,
        );
      }
    }

    return {
      sourceKey: pair.sourceKey,
      globalId: globalMatch?.id ?? "NO_ENCONTRADO",
      globalAntes: globalMatch ? matchLabel(globalMatch) : "NO_ENCONTRADO",
      globalDespues: `${pair.expectedHomeTeam} vs ${pair.expectedAwayTeam}`,
      sala: roomMatch ? matchLabel(roomMatch) : "NO_ENCONTRADA",
      startsAt: roomMatch?.startsAt.toISOString() ?? globalMatch?.startsAt.toISOString() ?? "-",
      statusGlobal: globalMatch?.status ?? "-",
      marcadorGlobal: globalMatch ? scoreLabel(globalMatch) : "-",
      predictionsGlobal: globalMatch?._count.predictions ?? "-",
      accion: action,
    };
  });

  console.log(`Sala: ${room.name} (${room.inviteCode})`);
  console.log(`Modo: ${wantsApply ? "APPLY" : "DRY-RUN"}`);
  console.log("\nPlan de alineacion de globales Round of 16:");
  console.table(planRows);

  if (warnings.length) {
    console.log("\nADVERTENCIAS:");
    for (const warning of warnings) console.log(`- ${warning}`);
  }
  if (criticalIssues.length) {
    console.log("\nRIESGOS CRITICOS:");
    for (const issue of criticalIssues) console.log(`- ${issue}`);
  }
  console.log(
    `\nResumen: ${plannedChanges.length} global(es) por actualizar, ` +
      `${planRows.length - plannedChanges.length} sin cambio o bloqueado(s).`,
  );

  if (!wantsApply) {
    console.log("DRY-RUN completado. No se escribio ningun dato.");
    if (criticalIssues.length) {
      console.log("El modo apply permanece bloqueado hasta resolver los riesgos criticos.");
    }
    return;
  }

  if (criticalIssues.length) {
    throw new Error("Aplicacion cancelada por riesgos criticos.");
  }
  if (!plannedChanges.length) {
    console.log("No hay cambios seguros por aplicar.");
    await auditFinalState(plannedChanges);
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const change of plannedChanges) {
      const updated = await tx.match.updateMany({
        where: {
          id: change.globalMatch.id,
          sourceKey: change.sourceKey,
          roomId: null,
          group: "Round of 16",
          status: "SCHEDULED",
          homeScore: null,
          awayScore: null,
          predictions: { none: {} },
          updatedAt: change.globalMatch.updatedAt,
        },
        data: {
          homeTeam: change.homeTeam,
          awayTeam: change.awayTeam,
        },
      });

      if (updated.count !== 1) {
        throw new Error(`${change.sourceKey}: cambio concurrente; se revierte toda la transaccion.`);
      }
    }
  });

  console.log(`Aplicacion completada: ${plannedChanges.length} global(es) alineado(s).`);
  await auditFinalState(plannedChanges);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
