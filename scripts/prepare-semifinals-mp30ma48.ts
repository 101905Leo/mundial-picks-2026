import { PrismaClient } from "@prisma/client";
import { calculatePredictionPoints } from "../src/lib/scoring";

const prisma = new PrismaClient();

const roomId = "cmqso1l7r0001js04zd47vbbs";
const roomInviteCode = "MP30MA48";
const roomName = "16avos Mundial 2026";
const competitionId = "competition-world-cup-2026";
const quarterfinalGroup = "Quarter-final";
const semifinalGroup = "Semi-final";
const applyToken = "YES";

const quarterfinals = [
  {
    fixture: 97,
    fifaGameId: "53452525",
    homeTeam: "France",
    awayTeam: "Morocco",
    startsAt: "2026-07-09T20:00:00.000Z",
    sourceKey: "openfootball-worldcup-2026-097-w89-w90",
    expectedHomeScore: 2,
    expectedAwayScore: 0,
  },
  {
    fixture: 98,
    fifaGameId: "53452527",
    homeTeam: "Spain",
    awayTeam: "Belgium",
    startsAt: "2026-07-10T19:00:00.000Z",
    sourceKey: "openfootball-worldcup-2026-098-w93-w94",
    expectedHomeScore: 2,
    expectedAwayScore: 1,
  },
  {
    fixture: 99,
    fifaGameId: "53452529",
    homeTeam: "Norway",
    awayTeam: "England",
    startsAt: "2026-07-11T21:00:00.000Z",
    sourceKey: "openfootball-worldcup-2026-099-w91-w92",
    expectedHomeScore: 1,
    expectedAwayScore: 2,
  },
  {
    fixture: 100,
    fifaGameId: "53452531",
    homeTeam: "Argentina",
    awayTeam: "Switzerland",
    startsAt: "2026-07-12T01:00:00.000Z",
    sourceKey: "openfootball-worldcup-2026-100-w95-w96",
    expectedHomeScore: 3,
    expectedAwayScore: 1,
  },
] as const;

const semifinals = [
  {
    fixture: 101,
    fifaGameId: "53452533",
    homeTeam: "France",
    awayTeam: "Spain",
    startsAt: "2026-07-14T19:00:00.000Z",
    colombiaTime: "2026-07-14 14:00",
    sourceKey: "openfootball-worldcup-2026-101-w97-w98",
  },
  {
    fixture: 102,
    fifaGameId: "53452535",
    homeTeam: "England",
    awayTeam: "Argentina",
    startsAt: "2026-07-15T19:00:00.000Z",
    colombiaTime: "2026-07-15 14:00",
    sourceKey: "openfootball-worldcup-2026-102-w99-w100",
  },
] as const;

type Quarterfinal = (typeof quarterfinals)[number];
type Semifinal = (typeof semifinals)[number];

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

type FixtureIdentity = {
  homeTeam: string;
  awayTeam: string;
  startsAt: string;
};

type PredictionSnapshot = {
  id: string;
  userId: string;
  homeScore: number;
  awayScore: number;
  points: number;
  manualPoints: number | null;
  user: { name: string };
};

type PlannedChange =
  | { kind: "create-global"; fixture: Semifinal }
  | { kind: "create-room"; fixture: Semifinal }
  | { kind: "update-global"; fixture: Semifinal; current: MatchSnapshot }
  | { kind: "update-room"; fixture: Semifinal; current: MatchSnapshot };

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

const predictionSelect = {
  id: true,
  userId: true,
  homeScore: true,
  awayScore: true,
  points: true,
  manualPoints: true,
  user: { select: { name: true } },
} as const;

function scoreLabel(match: Pick<MatchSnapshot, "homeScore" | "awayScore"> | null | undefined) {
  if (!match || match.homeScore === null || match.awayScore === null) return "-";
  return `${match.homeScore}-${match.awayScore}`;
}

function matchLabel(match: Pick<MatchSnapshot, "homeTeam" | "awayTeam"> | null | undefined) {
  if (!match) return "NO_EXISTE";
  return `${match.homeTeam} vs ${match.awayTeam}`;
}

function sameTeams(match: Pick<MatchSnapshot, "homeTeam" | "awayTeam">, fixture: Pick<FixtureIdentity, "homeTeam" | "awayTeam">) {
  return match.homeTeam === fixture.homeTeam && match.awayTeam === fixture.awayTeam;
}

function sameKickoff(match: Pick<MatchSnapshot, "startsAt">, fixture: Pick<FixtureIdentity, "startsAt">) {
  return match.startsAt.getTime() === new Date(fixture.startsAt).getTime();
}

function expectedScoreLabel(fixture: Quarterfinal) {
  return `${fixture.expectedHomeScore}-${fixture.expectedAwayScore}`;
}

function isSafeEmptyScheduled(match: MatchSnapshot) {
  return (
    match.status === "SCHEDULED" &&
    match.homeScore === null &&
    match.awayScore === null &&
    match.isPublished === false &&
    match._count.predictions === 0
  );
}

function describeMatch(match: MatchSnapshot | null | undefined) {
  if (!match) return "NO_EXISTE";
  return `${match.id} | ${matchLabel(match)} | ${match.startsAt.toISOString()} | ${match.status} | ${scoreLabel(match)} | published=${match.isPublished} | predictions=${match._count.predictions}`;
}

function duplicateGroups(matches: MatchSnapshot[]) {
  const byKey = new Map<string, MatchSnapshot[]>();
  for (const match of matches) {
    const key = `${match.roomId ?? "GLOBAL"}:${match.sourceKey ?? "NO_SOURCE"}:${match.startsAt.toISOString()}:${match.homeTeam}:${match.awayTeam}`;
    byKey.set(key, [...(byKey.get(key) ?? []), match]);
  }
  return [...byKey.values()].filter((grouped) => grouped.length > 1);
}

function createDataFor(fixture: Semifinal, roomIdValue: string | null) {
  return {
    sourceKey: roomIdValue === null ? fixture.sourceKey : null,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    group: semifinalGroup,
    startsAt: new Date(fixture.startsAt),
    status: "SCHEDULED" as const,
    homeScore: null,
    awayScore: null,
    isPublished: false,
    competitionId,
    roomId: roomIdValue,
  };
}

function scoreMatchesExpected(match: MatchSnapshot | null | undefined, fixture: Quarterfinal) {
  return (
    Boolean(match) &&
    match?.status === "FINISHED" &&
    match.homeScore === fixture.expectedHomeScore &&
    match.awayScore === fixture.expectedAwayScore
  );
}

async function auditFinalState() {
  const [globalMatches, roomMatches] = await Promise.all([
    prisma.match.findMany({
      where: { sourceKey: { in: semifinals.map((fixture) => fixture.sourceKey) } },
      select: matchSelect,
      orderBy: { startsAt: "asc" },
    }),
    prisma.match.findMany({
      where: { roomId, group: semifinalGroup },
      select: matchSelect,
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const problems: string[] = [];
  if (globalMatches.length !== 2) problems.push(`Globales ${semifinalGroup}: ${globalMatches.length}; esperados 2.`);
  if (roomMatches.length !== 2) problems.push(`Sala ${semifinalGroup}: ${roomMatches.length}; esperados 2.`);

  for (const fixture of semifinals) {
    const globalMatch = globalMatches.find((match) => match.sourceKey === fixture.sourceKey);
    const roomMatch = roomMatches.find((match) => sameTeams(match, fixture) && sameKickoff(match, fixture));

    if (!globalMatch) {
      problems.push(`${fixture.sourceKey}: global no encontrado.`);
    } else {
      if (globalMatch.roomId !== null) problems.push(`${fixture.sourceKey}: global tiene roomId.`);
      if (globalMatch.competitionId !== competitionId) problems.push(`${fixture.sourceKey}: competitionId incorrecto.`);
      if (globalMatch.group !== semifinalGroup) problems.push(`${fixture.sourceKey}: grupo incorrecto.`);
      if (!sameTeams(globalMatch, fixture) || !sameKickoff(globalMatch, fixture)) {
        problems.push(`${fixture.sourceKey}: global no coincide con fixture esperado.`);
      }
      if (!isSafeEmptyScheduled(globalMatch)) problems.push(`${fixture.sourceKey}: global no quedo SCHEDULED/null/unpublished/sin predictions.`);
    }

    if (!roomMatch) {
      problems.push(`${fixture.fixture}: copia de sala no encontrada.`);
    } else {
      if (roomMatch.roomId !== roomId) problems.push(`${roomMatch.id}: roomId incorrecto.`);
      if (roomMatch.sourceKey !== null) problems.push(`${roomMatch.id}: copia de sala no debe tener sourceKey.`);
      if (roomMatch.competitionId !== competitionId) problems.push(`${roomMatch.id}: competitionId incorrecto.`);
      if (roomMatch.group !== semifinalGroup) problems.push(`${roomMatch.id}: grupo incorrecto.`);
      if (!isSafeEmptyScheduled(roomMatch)) problems.push(`${roomMatch.id}: sala no quedo SCHEDULED/null/unpublished/sin predictions.`);
    }
  }

  console.log("\nAuditoria posterior semifinales:");
  console.table([
    ...globalMatches.map((match) => ({
      tipo: "global",
      id: match.id,
      sourceKey: match.sourceKey,
      partido: matchLabel(match),
      startsAt: match.startsAt.toISOString(),
      status: match.status,
      marcador: scoreLabel(match),
      published: match.isPublished,
      predictions: match._count.predictions,
    })),
    ...roomMatches.map((match) => ({
      tipo: "sala",
      id: match.id,
      sourceKey: match.sourceKey,
      partido: matchLabel(match),
      startsAt: match.startsAt.toISOString(),
      status: match.status,
      marcador: scoreLabel(match),
      published: match.isPublished,
      predictions: match._count.predictions,
    })),
  ]);

  if (problems.length) {
    throw new Error(`Auditoria posterior fallida:\n- ${problems.join("\n- ")}`);
  }
  console.log("Auditoria posterior aprobada: 2 globales y 2 copias de sala seguras.");
}

async function main() {
  const wantsApply = process.argv.includes("--apply");
  const hasApplyToken = process.env.APPLY_SF_MP30MA48 === applyToken;

  if (wantsApply !== hasApplyToken) {
    throw new Error("Aplicacion bloqueada: --apply y APPLY_SF_MP30MA48=YES deben estar presentes juntos.");
  }

  if (
    semifinals.length !== 2 ||
    new Set(semifinals.map((fixture) => fixture.sourceKey)).size !== 2 ||
    new Set(semifinals.map((fixture) => fixture.fifaGameId)).size !== 2 ||
    new Set(semifinals.map((fixture) => fixture.startsAt)).size !== 2
  ) {
    throw new Error("El plan debe contener exactamente 2 semifinales unicas.");
  }

  const room = await prisma.league.findUnique({
    where: { id: roomId },
    select: { id: true, name: true, inviteCode: true, competitionId: true },
  });
  if (!room || room.inviteCode !== roomInviteCode || room.name !== roomName || room.competitionId !== competitionId) {
    throw new Error(`No se encontro exactamente la sala esperada ${roomName} (${roomInviteCode}).`);
  }

  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { id: true, slug: true, name: true, season: true, isActive: true },
  });
  if (!competition) {
    throw new Error(`No se encontro la competencia base ${competitionId}.`);
  }

  const quarterStarts = quarterfinals.map((fixture) => new Date(fixture.startsAt));
  const semifinalStarts = semifinals.map((fixture) => new Date(fixture.startsAt));

  const [quarterGlobals, quarterRooms, semifinalGlobalsByKey, semifinalGlobals, semifinalRooms] =
    await Promise.all([
      prisma.match.findMany({
        where: {
          OR: [
            { sourceKey: { in: quarterfinals.map((fixture) => fixture.sourceKey) } },
            { roomId: null, competitionId, startsAt: { in: quarterStarts } },
          ],
        },
        select: matchSelect,
        orderBy: { startsAt: "asc" },
      }),
      prisma.match.findMany({
        where: { roomId, startsAt: { in: quarterStarts } },
        select: {
          ...matchSelect,
          predictions: { select: predictionSelect, orderBy: { user: { name: "asc" } } },
        },
        orderBy: { startsAt: "asc" },
      }),
      prisma.match.findMany({
        where: { sourceKey: { in: semifinals.map((fixture) => fixture.sourceKey) } },
        select: matchSelect,
        orderBy: { startsAt: "asc" },
      }),
      prisma.match.findMany({
        where: {
          roomId: null,
          competitionId,
          OR: [
            { group: semifinalGroup },
            { startsAt: { in: semifinalStarts } },
          ],
        },
        select: matchSelect,
        orderBy: { startsAt: "asc" },
      }),
      prisma.match.findMany({
        where: {
          roomId,
          OR: [
            { group: semifinalGroup },
            { startsAt: { in: semifinalStarts } },
          ],
        },
        select: matchSelect,
        orderBy: { startsAt: "asc" },
      }),
    ]);

  const quarterGlobalBySource = new Map(quarterGlobals.map((match) => [match.sourceKey, match]));
  const semifinalSourceMap = new Map(semifinalGlobalsByKey.map((match) => [match.sourceKey, match]));
  const plannedChanges: PlannedChange[] = [];
  const fatalIssues: string[] = [];
  const warnings: string[] = [];
  const pointChangeRows: Array<{
    fixture: number;
    partido: string;
    user: string;
    pick: string;
    pointsActual: number;
    manualPoints: number | null;
    expectedPoints: number;
  }> = [];

  const quarterRows = quarterfinals.map((fixture) => {
    const globalMatch = quarterGlobalBySource.get(fixture.sourceKey) ?? null;
    const roomCandidates = quarterRooms.filter((match) => sameKickoff(match, fixture));
    const roomMatch = roomCandidates.find((match) => sameTeams(match, fixture)) ?? roomCandidates[0] ?? null;
    const roomPredictions = (roomMatch?.predictions ?? []) as PredictionSnapshot[];
    const expectedResult = {
      homeScore: fixture.expectedHomeScore,
      awayScore: fixture.expectedAwayScore,
    };
    const incorrectPredictions = roomPredictions.filter((prediction) => {
      const expectedPoints = calculatePredictionPoints(
        { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
        expectedResult,
      );
      if (prediction.points !== expectedPoints) {
        pointChangeRows.push({
          fixture: fixture.fixture,
          partido: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          user: prediction.user.name,
          pick: `${prediction.homeScore}-${prediction.awayScore}`,
          pointsActual: prediction.points,
          manualPoints: prediction.manualPoints,
          expectedPoints,
        });
        return true;
      }
      return false;
    });

    if (!globalMatch) fatalIssues.push(`QF ${fixture.fixture}: global no encontrado por ${fixture.sourceKey}.`);
    if (!roomMatch) fatalIssues.push(`QF ${fixture.fixture}: partido de sala no encontrado.`);
    if (globalMatch && globalMatch.roomId !== null) fatalIssues.push(`QF ${fixture.fixture}: global tiene roomId.`);
    if (globalMatch && globalMatch.group !== quarterfinalGroup) warnings.push(`QF ${fixture.fixture}: grupo global es ${globalMatch.group}.`);
    if (roomMatch && roomMatch.group !== quarterfinalGroup) warnings.push(`QF ${fixture.fixture}: grupo sala es ${roomMatch.group}.`);
    if (globalMatch && !scoreMatchesExpected(globalMatch, fixture)) {
      warnings.push(
        `QF ${fixture.fixture}: marcador global difiere de esperado ${expectedScoreLabel(fixture)}.`,
      );
    }
    if (roomMatch && !scoreMatchesExpected(roomMatch, fixture)) {
      warnings.push(
        `QF ${fixture.fixture}: marcador sala difiere de esperado ${expectedScoreLabel(fixture)}.`,
      );
    }

    return {
      fixture: fixture.fixture,
      fifaGameId: fixture.fifaGameId,
      partido: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
      esperado: expectedScoreLabel(fixture),
      globalActual: describeMatch(globalMatch),
      salaActual: describeMatch(roomMatch),
      predictions: roomPredictions.length,
      puntosIncorrectos: incorrectPredictions.length,
    };
  });

  const semifinalRows = semifinals.map((fixture) => {
    const globalByKey = semifinalSourceMap.get(fixture.sourceKey) ?? null;
    const globalSameKickoff = semifinalGlobals.filter((match) => sameKickoff(match, fixture));
    const globalSameTeamsKickoff = globalSameKickoff.filter((match) => sameTeams(match, fixture));
    const roomSameKickoff = semifinalRooms.filter((match) => sameKickoff(match, fixture));
    const roomSameTeamsKickoff = roomSameKickoff.filter((match) => sameTeams(match, fixture));

    let globalAction = "SIN_CAMBIO";
    let roomAction = "SIN_CAMBIO";
    let globalTarget = globalByKey;
    let roomTarget = roomSameTeamsKickoff[0] ?? null;

    if (globalByKey) {
      if (globalByKey.roomId !== null) fatalIssues.push(`${fixture.sourceKey}: sourceKey pertenece a una sala.`);
      if (!sameKickoff(globalByKey, fixture)) fatalIssues.push(`${fixture.sourceKey}: horario global incorrecto.`);
      if (globalByKey.competitionId !== competitionId) fatalIssues.push(`${fixture.sourceKey}: competitionId global incorrecto.`);
      if (!isSafeEmptyScheduled(globalByKey)) fatalIssues.push(`${fixture.sourceKey}: global no esta SCHEDULED/null/unpublished/sin predictions.`);
      if (sameKickoff(globalByKey, fixture) && !sameTeams(globalByKey, fixture)) {
        globalAction = "ACTUALIZAR_GLOBAL";
        plannedChanges.push({ kind: "update-global", fixture, current: globalByKey });
      }
    } else if (globalSameTeamsKickoff.length === 1) {
      fatalIssues.push(`${fixture.sourceKey}: existe global por equipos/horario con otro sourceKey.`);
    } else if (globalSameKickoff.length === 1) {
      fatalIssues.push(`${fixture.sourceKey}: hay global en el mismo horario con otro sourceKey; revisar sourceKey antes de aplicar.`);
    } else if (globalSameKickoff.length > 1) {
      fatalIssues.push(`${fixture.sourceKey}: duplicados globales detectados en el horario.`);
    } else {
      globalAction = "CREAR_GLOBAL";
      plannedChanges.push({ kind: "create-global", fixture });
    }

    if (roomSameTeamsKickoff.length === 1) {
      roomTarget = roomSameTeamsKickoff[0];
      if (roomTarget.sourceKey !== null) fatalIssues.push(`${roomTarget.id}: copia de sala no debe tener sourceKey.`);
      if (roomTarget.competitionId !== competitionId) fatalIssues.push(`${roomTarget.id}: competitionId de sala incorrecto.`);
      if (!isSafeEmptyScheduled(roomTarget)) fatalIssues.push(`${roomTarget.id}: sala no esta SCHEDULED/null/unpublished/sin predictions.`);
    } else if (roomSameKickoff.length === 1) {
      roomTarget = roomSameKickoff[0];
      if (roomTarget.sourceKey !== null) fatalIssues.push(`${roomTarget.id}: copia de sala no debe tener sourceKey.`);
      if (roomTarget.competitionId !== competitionId) fatalIssues.push(`${roomTarget.id}: competitionId de sala incorrecto.`);
      if (!isSafeEmptyScheduled(roomTarget)) {
        fatalIssues.push(`${roomTarget.id}: sala no esta SCHEDULED/null/unpublished/sin predictions.`);
      } else {
        roomAction = "ACTUALIZAR_SALA";
        plannedChanges.push({ kind: "update-room", fixture, current: roomTarget });
      }
    } else if (roomSameKickoff.length > 1) {
      fatalIssues.push(`${fixture.fixture}: duplicados de sala detectados en el horario.`);
    } else {
      roomAction = "CREAR_SALA";
      plannedChanges.push({ kind: "create-room", fixture });
    }

    return {
      fixture: fixture.fixture,
      fifaGameId: fixture.fifaGameId,
      partidoFinal: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
      startsAtUTC: fixture.startsAt,
      horaColombia: fixture.colombiaTime,
      sourceKey: fixture.sourceKey,
      globalActual: describeMatch(globalTarget),
      globalAccion: globalAction,
      salaActual: describeMatch(roomTarget),
      salaAccion: roomAction,
    };
  });

  for (const duplicateGroup of duplicateGroups([...semifinalGlobals, ...semifinalRooms])) {
    fatalIssues.push(
      `Duplicado semifinal: ${duplicateGroup.map((match) => `${match.id} ${matchLabel(match)}`).join(" | ")}`,
    );
  }

  console.log(`Sala: ${room.name} (${room.inviteCode})`);
  console.log(`League ID: ${room.id}`);
  console.log(`Competition: ${competition.name} (${competition.id})`);
  console.log(`Modo: ${wantsApply ? "APPLY" : "DRY-RUN"}`);

  console.log("\nAuditoria de cuartos:");
  console.table(quarterRows);

  console.log("\nCambios individuales de puntos previstos si se recalcularan cuartos:");
  if (pointChangeRows.length) console.table(pointChangeRows);
  else console.log("Ninguno.");

  console.log("\nPlan de semifinales:");
  console.table(semifinalRows);

  console.log("\nDuplicados detectados:");
  const duplicateRows = duplicateGroups([...semifinalGlobals, ...semifinalRooms]).flatMap((matches) =>
    matches.map((match) => ({
      id: match.id,
      tipo: match.roomId ? "sala" : "global",
      sourceKey: match.sourceKey,
      partido: matchLabel(match),
      startsAt: match.startsAt.toISOString(),
      group: match.group,
    })),
  );
  if (duplicateRows.length) console.table(duplicateRows);
  else console.log("Ninguno.");

  if (warnings.length) {
    console.log("\nADVERTENCIAS:");
    for (const warning of warnings) console.log(`- ${warning}`);
  }
  if (fatalIssues.length) {
    console.log("\nRIESGOS CRITICOS:");
    for (const issue of fatalIssues) console.log(`- ${issue}`);
  }

  const createsGlobal = plannedChanges.filter((change) => change.kind === "create-global").length;
  const createsRoom = plannedChanges.filter((change) => change.kind === "create-room").length;
  const updatesGlobal = plannedChanges.filter((change) => change.kind === "update-global").length;
  const updatesRoom = plannedChanges.filter((change) => change.kind === "update-room").length;
  console.log(
    `\nResumen: ${createsGlobal} global(es) por crear, ${createsRoom} copia(s) de sala por crear, ` +
      `${updatesGlobal} global(es) por actualizar, ${updatesRoom} copia(s) de sala por actualizar, ` +
      `${pointChangeRows.length} prediccion(es) con puntos distintos a lo esperado en cuartos.`,
  );

  if (!wantsApply) {
    console.log("DRY-RUN completado. No se escribio ningun dato.");
    if (fatalIssues.length) console.log("El modo apply queda bloqueado hasta resolver los riesgos criticos.");
    return;
  }

  if (fatalIssues.length) {
    throw new Error("Aplicacion cancelada por riesgos criticos.");
  }
  if (!plannedChanges.length) {
    console.log("No hay cambios seguros por aplicar.");
    await auditFinalState();
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const change of plannedChanges) {
      if (change.kind === "create-global") {
        const existing = await tx.match.count({
          where: {
            OR: [
              { sourceKey: change.fixture.sourceKey },
              {
                roomId: null,
                competitionId,
                startsAt: new Date(change.fixture.startsAt),
              },
            ],
          },
        });
        if (existing !== 0) {
          throw new Error(`${change.fixture.sourceKey}: cambio concurrente antes de crear global.`);
        }
        await tx.match.create({ data: createDataFor(change.fixture, null) });
        continue;
      }

      if (change.kind === "create-room") {
        const existing = await tx.match.count({
          where: {
            roomId,
            startsAt: new Date(change.fixture.startsAt),
          },
        });
        if (existing !== 0) {
          throw new Error(`${change.fixture.fixture}: cambio concurrente antes de crear copia de sala.`);
        }
        await tx.match.create({ data: createDataFor(change.fixture, roomId) });
        continue;
      }

      const data = {
        homeTeam: change.fixture.homeTeam,
        awayTeam: change.fixture.awayTeam,
        group: semifinalGroup,
        startsAt: new Date(change.fixture.startsAt),
        competitionId,
        isPublished: false,
      };

      if (change.kind === "update-global") {
        const updated = await tx.match.updateMany({
          where: {
            id: change.current.id,
            roomId: null,
            sourceKey: change.fixture.sourceKey,
            status: "SCHEDULED",
            homeScore: null,
            awayScore: null,
            isPublished: false,
            predictions: { none: {} },
            updatedAt: change.current.updatedAt,
          },
          data,
        });
        if (updated.count !== 1) {
          throw new Error(`${change.current.id}: cambio concurrente al actualizar global.`);
        }
        continue;
      }

      const updated = await tx.match.updateMany({
        where: {
          id: change.current.id,
          roomId,
          sourceKey: null,
          status: "SCHEDULED",
          homeScore: null,
          awayScore: null,
          isPublished: false,
          predictions: { none: {} },
          updatedAt: change.current.updatedAt,
        },
        data,
      });
      if (updated.count !== 1) {
        throw new Error(`${change.current.id}: cambio concurrente al actualizar copia de sala.`);
      }
    }
  });

  console.log("Aplicacion completada.");
  await auditFinalState();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
