import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const roomId = "cmqso1l7r0001js04zd47vbbs";
const roomInviteCode = "MP30MA48";
const roomName = "16avos Mundial 2026";
const competitionId = "competition-world-cup-2026";
const group = "Quarter-final";
const applyToken = "YES";

const quarterfinals = [
  {
    fixture: 97,
    fifaGameId: "53452525",
    homeTeam: "France",
    awayTeam: "Morocco",
    startsAt: "2026-07-09T20:00:00.000Z",
    colombiaTime: "2026-07-09 15:00",
    sourceKey: "openfootball-worldcup-2026-097-w89-w90",
  },
  {
    fixture: 98,
    fifaGameId: "53452527",
    homeTeam: "Spain",
    awayTeam: "Belgium",
    startsAt: "2026-07-10T19:00:00.000Z",
    colombiaTime: "2026-07-10 14:00",
    sourceKey: "openfootball-worldcup-2026-098-w93-w94",
  },
  {
    fixture: 99,
    fifaGameId: "53452529",
    homeTeam: "Norway",
    awayTeam: "England",
    startsAt: "2026-07-11T21:00:00.000Z",
    colombiaTime: "2026-07-11 16:00",
    sourceKey: "openfootball-worldcup-2026-099-w91-w92",
  },
  {
    fixture: 100,
    fifaGameId: "53452531",
    homeTeam: "Argentina",
    awayTeam: "Switzerland",
    startsAt: "2026-07-12T01:00:00.000Z",
    colombiaTime: "2026-07-11 20:00",
    sourceKey: "openfootball-worldcup-2026-100-w95-w96",
  },
] as const;

type Quarterfinal = (typeof quarterfinals)[number];

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

type PlannedChange =
  | { kind: "create-global"; fixture: Quarterfinal }
  | { kind: "create-room"; fixture: Quarterfinal }
  | { kind: "update-global"; fixture: Quarterfinal; current: MatchSnapshot }
  | { kind: "update-room"; fixture: Quarterfinal; current: MatchSnapshot };

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

function scoreLabel(match: Pick<MatchSnapshot, "homeScore" | "awayScore"> | null | undefined) {
  if (!match || match.homeScore === null || match.awayScore === null) return "-";
  return `${match.homeScore}-${match.awayScore}`;
}

function matchLabel(match: Pick<MatchSnapshot, "homeTeam" | "awayTeam"> | null | undefined) {
  if (!match) return "NO_EXISTE";
  return `${match.homeTeam} vs ${match.awayTeam}`;
}

function sameTeams(match: Pick<MatchSnapshot, "homeTeam" | "awayTeam">, fixture: Quarterfinal) {
  return match.homeTeam === fixture.homeTeam && match.awayTeam === fixture.awayTeam;
}

function sameKickoff(match: Pick<MatchSnapshot, "startsAt">, fixture: Quarterfinal) {
  return match.startsAt.getTime() === new Date(fixture.startsAt).getTime();
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
    const key = `${match.roomId ?? "GLOBAL"}:${match.startsAt.toISOString()}`;
    byKey.set(key, [...(byKey.get(key) ?? []), match]);
  }
  return [...byKey.values()].filter((grouped) => grouped.length > 1);
}

function createDataFor(fixture: Quarterfinal, roomIdValue: string | null) {
  return {
    sourceKey: roomIdValue === null ? fixture.sourceKey : null,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    group,
    startsAt: new Date(fixture.startsAt),
    status: "SCHEDULED" as const,
    homeScore: null,
    awayScore: null,
    isPublished: false,
    competitionId,
    roomId: roomIdValue,
  };
}

async function auditFinalState() {
  const [globalMatches, roomMatches] = await Promise.all([
    prisma.match.findMany({
      where: { sourceKey: { in: quarterfinals.map((fixture) => fixture.sourceKey) } },
      select: matchSelect,
      orderBy: { startsAt: "asc" },
    }),
    prisma.match.findMany({
      where: { roomId, group },
      select: matchSelect,
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const problems: string[] = [];
  if (globalMatches.length !== 4) problems.push(`Globales ${group}: ${globalMatches.length}; esperados 4.`);
  if (roomMatches.length !== 4) problems.push(`Sala ${group}: ${roomMatches.length}; esperados 4.`);

  for (const fixture of quarterfinals) {
    const globalMatch = globalMatches.find((match) => match.sourceKey === fixture.sourceKey);
    const roomMatch = roomMatches.find((match) => sameTeams(match, fixture) && sameKickoff(match, fixture));

    if (!globalMatch) {
      problems.push(`${fixture.sourceKey}: global no encontrado.`);
    } else {
      if (globalMatch.roomId !== null) problems.push(`${fixture.sourceKey}: global tiene roomId.`);
      if (globalMatch.competitionId !== competitionId) problems.push(`${fixture.sourceKey}: competitionId incorrecto.`);
      if (globalMatch.group !== group) problems.push(`${fixture.sourceKey}: grupo incorrecto.`);
      if (!sameTeams(globalMatch, fixture) || !sameKickoff(globalMatch, fixture)) {
        problems.push(`${fixture.sourceKey}: global no coincide con fixture esperado.`);
      }
      if (!isSafeEmptyScheduled(globalMatch)) problems.push(`${fixture.sourceKey}: global no quedo vacio SCHEDULED seguro.`);
    }

    if (!roomMatch) {
      problems.push(`${fixture.fixture}: copia de sala no encontrada.`);
    } else {
      if (roomMatch.roomId !== roomId) problems.push(`${roomMatch.id}: roomId incorrecto.`);
      if (roomMatch.sourceKey !== null) problems.push(`${roomMatch.id}: la copia de sala no debe tener sourceKey.`);
      if (roomMatch.competitionId !== competitionId) problems.push(`${roomMatch.id}: competitionId incorrecto.`);
      if (roomMatch.group !== group) problems.push(`${roomMatch.id}: grupo incorrecto.`);
      if (!isSafeEmptyScheduled(roomMatch)) problems.push(`${roomMatch.id}: sala no quedo vacia SCHEDULED segura.`);
    }
  }

  console.log("\nAuditoria posterior:");
  console.table([
    ...globalMatches.map((match) => ({
      tipo: "global",
      id: match.id,
      sourceKey: match.sourceKey,
      partido: matchLabel(match),
      startsAt: match.startsAt.toISOString(),
      colombia: quarterfinals.find((fixture) => fixture.sourceKey === match.sourceKey)?.colombiaTime ?? "-",
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
      colombia:
        quarterfinals.find((fixture) => sameTeams(match, fixture) && sameKickoff(match, fixture))?.colombiaTime ?? "-",
      status: match.status,
      marcador: scoreLabel(match),
      published: match.isPublished,
      predictions: match._count.predictions,
    })),
  ]);

  if (problems.length) {
    throw new Error(`Auditoria posterior fallida:\n- ${problems.join("\n- ")}`);
  }
  console.log("Auditoria posterior aprobada: 4 globales y 4 copias de sala seguras.");
}

async function main() {
  const wantsApply = process.argv.includes("--apply");
  const hasApplyToken = process.env.APPLY_QF_MP30MA48 === applyToken;

  if (wantsApply !== hasApplyToken) {
    throw new Error("Aplicacion bloqueada: --apply y APPLY_QF_MP30MA48=YES deben estar presentes juntos.");
  }

  if (
    quarterfinals.length !== 4 ||
    new Set(quarterfinals.map((fixture) => fixture.sourceKey)).size !== 4 ||
    new Set(quarterfinals.map((fixture) => fixture.fifaGameId)).size !== 4 ||
    new Set(quarterfinals.map((fixture) => fixture.startsAt)).size !== 4
  ) {
    throw new Error("El plan debe contener exactamente 4 partidos unicos de cuartos.");
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

  const [globalBySourceKey, globalQuarterfinals, roomQuarterfinals, roomAllMatches] = await Promise.all([
    prisma.match.findMany({
      where: { sourceKey: { in: quarterfinals.map((fixture) => fixture.sourceKey) } },
      select: matchSelect,
      orderBy: { startsAt: "asc" },
    }),
    prisma.match.findMany({
      where: {
        roomId: null,
        competitionId,
        OR: [
          { group },
          { startsAt: { in: quarterfinals.map((fixture) => new Date(fixture.startsAt)) } },
        ],
      },
      select: matchSelect,
      orderBy: { startsAt: "asc" },
    }),
    prisma.match.findMany({
      where: {
        roomId,
        OR: [
          { group },
          { startsAt: { in: quarterfinals.map((fixture) => new Date(fixture.startsAt)) } },
        ],
      },
      select: matchSelect,
      orderBy: { startsAt: "asc" },
    }),
    prisma.match.findMany({
      where: { roomId },
      select: { id: true, group: true, homeTeam: true, awayTeam: true, startsAt: true, status: true },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const sourceKeyMap = new Map(globalBySourceKey.map((match) => [match.sourceKey, match]));
  const plannedChanges: PlannedChange[] = [];
  const fatalIssues: string[] = [];
  const warnings: string[] = [];

  const planRows = quarterfinals.map((fixture) => {
    const kickoff = new Date(fixture.startsAt);
    const globalByKey = sourceKeyMap.get(fixture.sourceKey);
    const globalSameTeamsKickoff = globalQuarterfinals.filter(
      (match) => sameTeams(match, fixture) && sameKickoff(match, fixture),
    );
    const globalSameKickoff = globalQuarterfinals.filter((match) => sameKickoff(match, fixture));
    const roomSameTeamsKickoff = roomQuarterfinals.filter(
      (match) => sameTeams(match, fixture) && sameKickoff(match, fixture),
    );
    const roomSameKickoff = roomQuarterfinals.filter((match) => sameKickoff(match, fixture));

    let globalAction = "SIN_CAMBIO";
    let roomAction = "SIN_CAMBIO";
    let globalTarget = globalByKey ?? null;
    let roomTarget = roomSameTeamsKickoff[0] ?? null;

    if (globalByKey) {
      if (globalByKey.roomId !== null) fatalIssues.push(`${fixture.sourceKey}: sourceKey pertenece a una sala.`);
      if (!sameKickoff(globalByKey, fixture)) fatalIssues.push(`${fixture.sourceKey}: horario global incorrecto.`);
      if (globalByKey.group !== group) fatalIssues.push(`${fixture.sourceKey}: grupo global incorrecto.`);
      if (globalByKey.competitionId !== competitionId) fatalIssues.push(`${fixture.sourceKey}: competitionId global incorrecto.`);
      if (!isSafeEmptyScheduled(globalByKey)) {
        fatalIssues.push(`${fixture.sourceKey}: global no esta SCHEDULED/null/unpublished/sin predictions.`);
      }
      if (sameKickoff(globalByKey, fixture) && !sameTeams(globalByKey, fixture)) {
        globalAction = "ACTUALIZAR_GLOBAL";
        plannedChanges.push({ kind: "update-global", fixture, current: globalByKey });
      }
    } else if (globalSameTeamsKickoff.length === 1) {
      fatalIssues.push(`${fixture.sourceKey}: existe global por equipos/horario con otro sourceKey.`);
    } else if (globalSameKickoff.length > 0) {
      fatalIssues.push(`${fixture.sourceKey}: hay global(es) en el mismo horario con otros equipos.`);
    } else {
      globalAction = "CREAR_GLOBAL";
      plannedChanges.push({ kind: "create-global", fixture });
    }

    if (globalSameTeamsKickoff.length > 1 || globalSameKickoff.length > 1) {
      fatalIssues.push(`${fixture.sourceKey}: duplicados globales detectados en el horario.`);
    }

    if (roomSameTeamsKickoff.length === 1) {
      roomTarget = roomSameTeamsKickoff[0];
      if (roomTarget.sourceKey !== null) fatalIssues.push(`${roomTarget.id}: copia de sala no debe tener sourceKey.`);
      if (roomTarget.group !== group) fatalIssues.push(`${roomTarget.id}: grupo de sala incorrecto.`);
      if (roomTarget.competitionId !== competitionId) fatalIssues.push(`${roomTarget.id}: competitionId de sala incorrecto.`);
      if (!isSafeEmptyScheduled(roomTarget)) {
        fatalIssues.push(`${roomTarget.id}: sala no esta SCHEDULED/null/unpublished/sin predictions.`);
      }
    } else if (roomSameKickoff.length > 0) {
      if (roomSameKickoff.length === 1) {
        roomTarget = roomSameKickoff[0];
        if (roomTarget.sourceKey !== null) fatalIssues.push(`${roomTarget.id}: copia de sala no debe tener sourceKey.`);
        if (roomTarget.group !== group) fatalIssues.push(`${roomTarget.id}: grupo de sala incorrecto.`);
        if (roomTarget.competitionId !== competitionId) fatalIssues.push(`${roomTarget.id}: competitionId de sala incorrecto.`);
        if (!isSafeEmptyScheduled(roomTarget)) {
          fatalIssues.push(`${roomTarget.id}: sala no esta SCHEDULED/null/unpublished/sin predictions.`);
        } else {
          roomAction = "ACTUALIZAR_SALA";
          plannedChanges.push({ kind: "update-room", fixture, current: roomTarget });
        }
      } else {
        fatalIssues.push(`${fixture.fixture}: hay partido de sala en el mismo horario con otros equipos.`);
      }
    } else {
      roomAction = "CREAR_SALA";
      plannedChanges.push({ kind: "create-room", fixture });
    }

    if (roomSameTeamsKickoff.length > 1 || roomSameKickoff.length > 1) {
      fatalIssues.push(`${fixture.fixture}: duplicados de sala detectados en el horario.`);
    }

    const previousRoomMatchesAtKickoff = roomAllMatches.filter(
      (match) => match.startsAt.getTime() === kickoff.getTime() && match.group !== group,
    );
    if (previousRoomMatchesAtKickoff.length) {
      warnings.push(
        `${fixture.fixture}: hay partido(s) previos de sala en el mismo horario fuera de ${group}; revisar antes de aplicar.`,
      );
    }

    return {
      fixture: fixture.fixture,
      fifaGameId: fixture.fifaGameId,
      partido: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
      startsAtUTC: fixture.startsAt,
      horaColombia: fixture.colombiaTime,
      sourceKey: fixture.sourceKey,
      globalActual: describeMatch(globalTarget),
      globalAccion: globalAction,
      salaActual: describeMatch(roomTarget),
      salaAccion: roomAction,
    };
  });

  for (const duplicateGroup of duplicateGroups([...globalQuarterfinals, ...roomQuarterfinals])) {
    fatalIssues.push(
      `Duplicado por horario: ${duplicateGroup.map((match) => `${match.id} ${matchLabel(match)}`).join(" | ")}`,
    );
  }

  console.log(`Sala: ${room.name} (${room.inviteCode})`);
  console.log(`League ID: ${room.id}`);
  console.log(`Competition: ${competition.name} (${competition.id})`);
  console.log(`Modo: ${wantsApply ? "APPLY" : "DRY-RUN"}`);
  console.log("\nPlan de cuartos:");
  console.table(planRows);

  console.log("\nDuplicados detectados:");
  const duplicateRows = duplicateGroups([...globalQuarterfinals, ...roomQuarterfinals]).flatMap((matches) =>
    matches.map((match) => ({
      id: match.id,
      tipo: match.roomId ? "sala" : "global",
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
      `${updatesGlobal} global(es) por actualizar, ${updatesRoom} copia(s) de sala por actualizar.`,
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
        group,
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
