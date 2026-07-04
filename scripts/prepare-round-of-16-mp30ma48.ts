import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const roomId = "cmqso1l7r0001js04zd47vbbs";
const roomInviteCode = "MP30MA48";
const roomName = "16avos Mundial 2026";
const competitionId = "competition-world-cup-2026";
const applyToken = "YES";

const roundOf32Fixtures = [
  { fixture: 73, roomMatchId: "cmqso2dnt004fl204vbopnx62", globalMatchId: "cmq7kkpba0020jp04bmm50kko" },
  { fixture: 74, roomMatchId: "cmqso2dny004jl2043kpeyuvi", globalMatchId: "cmqxajc3q0044l104n1puee4v" },
  { fixture: 75, roomMatchId: "cmqso2do0004ll204mywzzcqm", globalMatchId: "cmqxajc3y0046l104jy2lnva2" },
  { fixture: 76, roomMatchId: "cmqso2dnv004hl20400ldtkdu", globalMatchId: "cmqxajc450048l104s1d6x68d" },
  { fixture: 77, roomMatchId: "cmqso2do4004pl204ytiwsrd1", globalMatchId: "cmq7kkpc40024jp04xlc2b9ct" },
  { fixture: 78, roomMatchId: "cmqso2do2004nl204ueciu7jm", globalMatchId: "cmqxajc4k004cl104pk8gksug" },
  { fixture: 79, roomMatchId: "cmqso2do6004rl204akavw08z", globalMatchId: "cmqxajc4s004el1042ka0i98k" },
  { fixture: 80, roomMatchId: "cmqso2do8004tl204sbw4frih", globalMatchId: "cmq7kkpcq0027jp04csk5va05" },
  { fixture: 81, roomMatchId: "cmqso2dod004xl204rptmphzy", globalMatchId: "cmqxajc57004il104xhhm18gv" },
  { fixture: 82, roomMatchId: "cmqso2doa004vl20456fj2lio", globalMatchId: "cmq7kkpd40029jp04k6zgnkbi" },
  { fixture: 83, roomMatchId: "cmqso2doh0051l204iabcnnmx", globalMatchId: "cmq7kkpdc002ajp04iyw9wn1c" },
  { fixture: 84, roomMatchId: "cmqso2dof004zl204e5ia9esq", globalMatchId: "cmq7kkpdj002bjp04pkjaz40g" },
  { fixture: 85, roomMatchId: "cmqso2doj0053l204n3w5x34o", globalMatchId: "cmqxajc60004ql104pw3k48gc" },
  { fixture: 86, roomMatchId: "cmqso2dos0057l204lumrifyr", globalMatchId: "cmq7kkpdy002djp04voyl98dy" },
  { fixture: 87, roomMatchId: "cmqso2dou0059l204dtm3nga5", globalMatchId: "cmq7kkpe6002ejp04oadmn5q7" },
  { fixture: 88, roomMatchId: "cmqso2doq0055l204ofu0nt0x", globalMatchId: "cmqxajc6p004wl104e2q5iow1" },
] as const;

const roundOf16Fixtures = [
  {
    fixture: 90,
    roomMatchId: "cmqso2dox005bl2040bp1ne50",
    globalMatchId: "cmq7kkpet002hjp046isf9gff",
    homeFrom: 73,
    awayFrom: 75,
    startsAt: "2026-07-04T17:00:00.000Z",
  },
  {
    fixture: 89,
    roomMatchId: "cmqso2doz005dl2041oin7vqy",
    globalMatchId: "cmq7kkpel002gjp04odayniq3",
    homeFrom: 74,
    awayFrom: 77,
    startsAt: "2026-07-04T21:00:00.000Z",
  },
  {
    fixture: 91,
    roomMatchId: "cmqso2dp1005fl204zcukwz57",
    globalMatchId: "cmq7kkpf1002ijp04vin8qv4r",
    homeFrom: 76,
    awayFrom: 78,
    startsAt: "2026-07-05T20:00:00.000Z",
  },
  {
    fixture: 92,
    roomMatchId: "cmqso2dp4005hl204ih3kwm2e",
    globalMatchId: "cmq7kkpf8002jjp041oujugqq",
    homeFrom: 79,
    awayFrom: 80,
    startsAt: "2026-07-06T00:00:00.000Z",
  },
  {
    fixture: 93,
    roomMatchId: "cmqso2dp6005jl20493du1fny",
    globalMatchId: "cmq7kkpfg002kjp04n3xowdx3",
    homeFrom: 83,
    awayFrom: 84,
    startsAt: "2026-07-06T19:00:00.000Z",
  },
  {
    fixture: 94,
    roomMatchId: "cmqso2dp8005ll2042gnv4rn4",
    globalMatchId: "cmq7kkpfn002ljp04zb8fgqgy",
    homeFrom: 81,
    awayFrom: 82,
    startsAt: "2026-07-07T00:00:00.000Z",
  },
  {
    fixture: 95,
    roomMatchId: "cmqso2dpa005nl2045iuodsmm",
    globalMatchId: "cmq7kkpfv002mjp04jivbaw2j",
    homeFrom: 86,
    awayFrom: 88,
    startsAt: "2026-07-07T16:00:00.000Z",
  },
  {
    fixture: 96,
    roomMatchId: "cmqso2dpd005pl204zpjosz18",
    globalMatchId: "cmq7kkpg3002njp04tdb5vp6m",
    homeFrom: 85,
    awayFrom: 87,
    startsAt: "2026-07-07T20:00:00.000Z",
  },
] as const;

const tiedWinnerOverrides: Readonly<Record<string, string>> = {
  cmqso2dny004jl2043kpeyuvi: "Paraguay",
  cmqso2do0004ll204mywzzcqm: "Morocco",
  cmqso2doq0055l204ofu0nt0x: "Egypt",
};

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
  | {
      kind: "create";
      fixture: (typeof roundOf16Fixtures)[number];
      homeTeam: string;
      awayTeam: string;
    }
  | {
      kind: "update";
      fixture: (typeof roundOf16Fixtures)[number];
      current: MatchSnapshot;
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

function scoreLabel(match: MatchSnapshot | undefined) {
  if (!match || match.homeScore === null || match.awayScore === null) return "-";
  return `${match.homeScore}-${match.awayScore}`;
}

function isPlaceholder(team: string) {
  const value = team.trim();
  return /^(?:W|L)\d+$/i.test(value) ||
    /^(?:TBD|TBC|Winner|Ganador)(?:\s|$)/i.test(value) ||
    /^\d+[A-L](?:\/|$)/i.test(value);
}

function winnerOf(match: MatchSnapshot | undefined) {
  if (!match) {
    return {
      team: null,
      reason: "PARTIDO_NO_ENCONTRADO",
      source: "PENDIENTE" as const,
      error: null,
    };
  }
  if (match.status !== "FINISHED") {
    return {
      team: null,
      reason: "PENDIENTE_DE_RESULTADO",
      source: "PENDIENTE" as const,
      error: null,
    };
  }
  if (match.homeScore === null || match.awayScore === null) {
    return {
      team: null,
      reason: "PENDIENTE_DE_RESULTADO",
      source: "PENDIENTE" as const,
      error: null,
    };
  }
  if (match.homeScore !== match.awayScore) {
    return {
      team: match.homeScore > match.awayScore ? match.homeTeam : match.awayTeam,
      reason: "GANADOR_POR_MARCADOR",
      source: "MARCADOR" as const,
      error: null,
    };
  }

  const overrideWinner = tiedWinnerOverrides[match.id];
  if (!overrideWinner) {
    return {
      team: null,
      reason: "PENDIENTE_DE_RESULTADO: EMPATE_SIN_OVERRIDE",
      source: "PENDIENTE" as const,
      error: null,
    };
  }
  if (overrideWinner !== match.homeTeam && overrideWinner !== match.awayTeam) {
    return {
      team: null,
      reason: "OVERRIDE_INVALIDO",
      source: "PENDIENTE" as const,
      error: `${match.id}: el override ${overrideWinner} no participa en ${match.homeTeam} vs ${match.awayTeam}.`,
    };
  }

  return {
    team: overrideWinner,
    reason: "GANADOR_POR_OVERRIDE_DE_DESEMPATE",
    source: "OVERRIDE_DESEMPATE" as const,
    error: null,
  };
}

function sameTeams(match: MatchSnapshot, homeTeam: string, awayTeam: string) {
  return match.homeTeam === homeTeam && match.awayTeam === awayTeam;
}

function duplicateKickoffs(matches: MatchSnapshot[]) {
  const byKickoff = new Map<number, MatchSnapshot[]>();
  for (const match of matches) {
    const kickoff = match.startsAt.getTime();
    byKickoff.set(kickoff, [...(byKickoff.get(kickoff) ?? []), match]);
  }
  return [...byKickoff.values()].filter((matchesAtKickoff) => matchesAtKickoff.length > 1);
}

async function auditFinalState(expectedRoundOf32UpdatedAt: Map<string, number>) {
  const [roomRoundOf16, roomRoundOf32] = await Promise.all([
    prisma.match.findMany({
      where: { roomId, group: "Round of 16" },
      select: matchSelect,
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.match.findMany({
      where: { id: { in: roundOf32Fixtures.map((fixture) => fixture.roomMatchId) } },
      select: { id: true, updatedAt: true },
    }),
  ]);

  const problems: string[] = [];
  if (roomRoundOf16.length !== 8) {
    problems.push(`La sala tiene ${roomRoundOf16.length} partidos Round of 16; se esperaban 8.`);
  }
  if (duplicateKickoffs(roomRoundOf16).length) {
    problems.push("Hay horarios duplicados entre los partidos Round of 16 de la sala.");
  }
  for (const fixture of roundOf16Fixtures) {
    const matchesAtExpectedKickoff = roomRoundOf16.filter(
      (match) => match.startsAt.getTime() === new Date(fixture.startsAt).getTime(),
    );
    if (matchesAtExpectedKickoff.length !== 1) {
      problems.push(
        `R16 ${fixture.fixture}: se encontro ${matchesAtExpectedKickoff.length} partido(s) en el horario esperado.`,
      );
    }
  }

  for (const match of roomRoundOf16) {
    if (match.roomId !== roomId) problems.push(`${match.id}: roomId incorrecto.`);
    if (match.competitionId !== competitionId) problems.push(`${match.id}: competitionId incorrecto.`);
    if (match.status !== "SCHEDULED") problems.push(`${match.id}: no esta SCHEDULED.`);
    if (match.isPublished) problems.push(`${match.id}: esta publicado.`);
    if (match.homeScore !== null || match.awayScore !== null) problems.push(`${match.id}: tiene marcador.`);
    if (match._count.predictions !== 0) problems.push(`${match.id}: tiene predictions.`);
  }

  for (const match of roomRoundOf32) {
    if (expectedRoundOf32UpdatedAt.get(match.id) !== match.updatedAt.getTime()) {
      problems.push(`${match.id}: un partido Round of 32 fue modificado.`);
    }
  }

  console.log("\nAuditoria posterior:");
  console.table(
    roomRoundOf16.map((match) => ({
      id: match.id,
      partido: `${match.homeTeam} vs ${match.awayTeam}`,
      startsAt: match.startsAt.toISOString(),
      status: match.status,
      publicado: match.isPublished,
      marcador: scoreLabel(match),
      predictions: match._count.predictions,
    })),
  );

  if (problems.length) {
    throw new Error(`Auditoria posterior fallida:\n- ${problems.join("\n- ")}`);
  }
  console.log("Auditoria posterior aprobada: 8 partidos seguros y Round of 32 sin cambios.");
}

async function main() {
  const wantsApply = process.argv.includes("--apply");
  const hasApplyToken = process.env.APPLY_R16_MP30MA48 === applyToken;

  if (wantsApply !== hasApplyToken) {
    throw new Error(
      "Aplicacion bloqueada: --apply y APPLY_R16_MP30MA48=YES deben estar presentes juntos.",
    );
  }

  const room = await prisma.league.findUnique({
    where: { id: roomId },
    select: { id: true, name: true, inviteCode: true, competitionId: true },
  });
  if (
    !room ||
    room.name !== roomName ||
    room.inviteCode !== roomInviteCode ||
    room.competitionId !== competitionId
  ) {
    throw new Error(`No se encontro exactamente la sala auditada ${roomName} (${roomInviteCode}).`);
  }

  const roundOf32Ids = roundOf32Fixtures.flatMap((fixture) => [
    fixture.roomMatchId,
    fixture.globalMatchId,
  ]);
  const roundOf16Ids = roundOf16Fixtures.flatMap((fixture) => [
    fixture.roomMatchId,
    fixture.globalMatchId,
  ]);

  if (
    roundOf32Fixtures.length !== 16 ||
    roundOf16Fixtures.length !== 8 ||
    new Set(roundOf32Ids).size !== 32 ||
    new Set(roundOf16Ids).size !== 16
  ) {
    throw new Error("El plan fijo debe contener 16 cruces de Round of 32 y 8 cruces de Round of 16.");
  }

  const [roundOf32Matches, roundOf16Targets, allRoomRoundOf16, allGlobalRoundOf16] =
    await Promise.all([
      prisma.match.findMany({ where: { id: { in: roundOf32Ids } }, select: matchSelect }),
      prisma.match.findMany({ where: { id: { in: roundOf16Ids } }, select: matchSelect }),
      prisma.match.findMany({
        where: { roomId, group: "Round of 16" },
        select: matchSelect,
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      }),
      prisma.match.findMany({
        where: { roomId: null, competitionId, group: "Round of 16" },
        select: matchSelect,
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      }),
    ]);

  const roundOf32ById = new Map(roundOf32Matches.map((match) => [match.id, match]));
  const roundOf16ById = new Map(roundOf16Targets.map((match) => [match.id, match]));
  const roomRoundOf32ByFixture = new Map(
    roundOf32Fixtures.map((fixture) => [
      fixture.fixture,
      roundOf32ById.get(fixture.roomMatchId),
    ]),
  );
  const expectedRoundOf32UpdatedAt = new Map(
    roundOf32Fixtures.flatMap((fixture) => {
      const match = roundOf32ById.get(fixture.roomMatchId);
      return match ? [[match.id, match.updatedAt.getTime()] as const] : [];
    }),
  );

  const fatalIssues: string[] = [];
  const warnings: string[] = [];
  const pendingResults: string[] = [];

  const roundOf32Rows = roundOf32Fixtures.map((fixture) => {
    const roomMatch = roundOf32ById.get(fixture.roomMatchId);
    const globalMatch = roundOf32ById.get(fixture.globalMatchId);
    const roomWinner = winnerOf(roomMatch);
    const globalWinner = winnerOf(globalMatch);

    if (!roomMatch) fatalIssues.push(`R32 ${fixture.fixture}: partido de sala no encontrado.`);
    if (!globalMatch) warnings.push(`R32 ${fixture.fixture}: partido global canonico no encontrado.`);
    if (roomWinner.error) fatalIssues.push(roomWinner.error);

    if (roomMatch) {
      if (roomMatch.roomId !== roomId) fatalIssues.push(`${roomMatch.id}: pertenece a otra sala.`);
      if (roomMatch.competitionId !== competitionId) {
        fatalIssues.push(`${roomMatch.id}: competitionId incorrecto.`);
      }
      if (roomMatch.group !== "Round of 32") fatalIssues.push(`${roomMatch.id}: grupo incorrecto.`);
      if (
        roomMatch.status !== "FINISHED" ||
        roomMatch.homeScore === null ||
        roomMatch.awayScore === null
      ) {
        pendingResults.push(`R32 ${fixture.fixture}: PENDIENTE_DE_RESULTADO.`);
      }
    }

    const aligned = Boolean(
      roomMatch &&
        globalMatch &&
        globalMatch.roomId === null &&
        globalMatch.competitionId === competitionId &&
        sameTeams(globalMatch, roomMatch.homeTeam, roomMatch.awayTeam) &&
        globalMatch.startsAt.getTime() === roomMatch.startsAt.getTime() &&
        globalMatch.status === roomMatch.status &&
        globalMatch.homeScore === roomMatch.homeScore &&
        globalMatch.awayScore === roomMatch.awayScore,
    );
    if (roomMatch && globalMatch && !aligned) {
      if (roomWinner.team && globalWinner.team && roomWinner.team !== globalWinner.team) {
        fatalIssues.push(
          `R32 ${fixture.fixture}: sala y global cambian el ganador ` +
            `(${roomWinner.team} vs ${globalWinner.team}).`,
        );
      } else if (roomWinner.team && globalWinner.team === roomWinner.team) {
        warnings.push(
          `R32 ${fixture.fixture}: sala y global difieren, pero mantienen al ganador ` +
            `${roomWinner.team}; aviso no bloqueante.`,
        );
      } else {
        warnings.push(
          `R32 ${fixture.fixture}: sala y global no estan alineados; ` +
            `el global aun no confirma al ganador ${roomWinner.team ?? "de la sala"}.`,
        );
      }
    }

    return {
      fixture: fixture.fixture,
      roomMatchId: roomMatch?.id ?? "NO_ENCONTRADO",
      partido: roomMatch ? `${roomMatch.homeTeam} vs ${roomMatch.awayTeam}` : "-",
      startsAt: roomMatch?.startsAt.toISOString() ?? "-",
      sala: roomMatch ? `${roomMatch.status} ${scoreLabel(roomMatch)}` : "-",
      global: globalMatch ? `${globalMatch.status} ${scoreLabel(globalMatch)}` : "-",
      ganador: roomWinner.team ?? "PENDIENTE",
      fuenteGanador: roomWinner.source,
      alineado: aligned ? "SI" : "NO",
    };
  });

  const roomDuplicates = duplicateKickoffs(allRoomRoundOf16);
  const globalDuplicates = duplicateKickoffs(allGlobalRoundOf16);
  if (roomDuplicates.length) fatalIssues.push("Hay duplicados Round of 16 en la sala por horario.");
  if (globalDuplicates.length) fatalIssues.push("Hay duplicados globales Round of 16 por horario.");
  if (allRoomRoundOf16.length > 8) {
    fatalIssues.push(`La sala ya tiene ${allRoomRoundOf16.length} partidos Round of 16.`);
  }
  if (allGlobalRoundOf16.length !== 8) {
    warnings.push(`Se encontraron ${allGlobalRoundOf16.length} globales Round of 16; se esperaban 8.`);
  }

  const plannedChanges: PlannedChange[] = [];
  const roundOf16Rows = roundOf16Fixtures.map((fixture) => {
    const globalMatch = roundOf16ById.get(fixture.globalMatchId);
    const expectedRoomMatch = roundOf16ById.get(fixture.roomMatchId);
    const sameKickoffRoomMatches = allRoomRoundOf16.filter(
      (match) => match.startsAt.getTime() === new Date(fixture.startsAt).getTime(),
    );
    const roomMatch =
      expectedRoomMatch ??
      (sameKickoffRoomMatches.length === 1 ? sameKickoffRoomMatches[0] : undefined);

    if (expectedRoomMatch && expectedRoomMatch.roomId !== roomId) {
      fatalIssues.push(`${fixture.roomMatchId}: el ID esperado pertenece a otra sala.`);
    }
    if (!expectedRoomMatch && sameKickoffRoomMatches.length > 0) {
      fatalIssues.push(
        `R16 ${fixture.fixture}: hay un partido distinto en el horario objetivo; no se creara otro.`,
      );
    }
    if (!globalMatch) {
      fatalIssues.push(`R16 ${fixture.fixture}: global ${fixture.globalMatchId} no encontrado.`);
      return {
        fixture: fixture.fixture,
        global: "NO_ENCONTRADO",
        sala: roomMatch ? `${roomMatch.homeTeam} vs ${roomMatch.awayTeam}` : "NO_EXISTE",
        propuesto: "PENDIENTE_DE_RESULTADO",
        accion: "SALTAR",
      };
    }
    if (
      globalMatch.roomId !== null ||
      globalMatch.competitionId !== competitionId ||
      globalMatch.group !== "Round of 16" ||
      globalMatch.startsAt.toISOString() !== fixture.startsAt
    ) {
      fatalIssues.push(`R16 ${fixture.fixture}: el global no coincide con el plan auditado.`);
    }

    const homeWinner = winnerOf(roomRoundOf32ByFixture.get(fixture.homeFrom));
    const awayWinner = winnerOf(roomRoundOf32ByFixture.get(fixture.awayFrom));
    if (homeWinner.error) fatalIssues.push(homeWinner.error);
    if (awayWinner.error) fatalIssues.push(awayWinner.error);
    const globalHasRealTeams =
      !isPlaceholder(globalMatch.homeTeam) && !isPlaceholder(globalMatch.awayTeam);

    let proposedHome: string | null = null;
    let proposedAway: string | null = null;
    let source = "PENDIENTE_DE_RESULTADO";

    if (globalHasRealTeams) {
      proposedHome = globalMatch.homeTeam;
      proposedAway = globalMatch.awayTeam;
      source = "GLOBAL_R16";
      if (homeWinner.team && homeWinner.team !== proposedHome) {
        fatalIssues.push(`R16 ${fixture.fixture}: el local global contradice al ganador de sala.`);
      }
      if (awayWinner.team && awayWinner.team !== proposedAway) {
        fatalIssues.push(`R16 ${fixture.fixture}: el visitante global contradice al ganador de sala.`);
      }
    } else if (homeWinner.team && awayWinner.team) {
      proposedHome = homeWinner.team;
      proposedAway = awayWinner.team;
      source = `R32_${homeWinner.source}+${awayWinner.source}`;
    } else {
      pendingResults.push(
        `R16 ${fixture.fixture}: PENDIENTE_DE_RESULTADO (${homeWinner.reason}; ${awayWinner.reason}).`,
      );
    }

    let action = "SALTAR_INCOMPLETO";
    if (proposedHome && proposedAway) {
      if (roomMatch) {
        const unsafeExistingState =
          roomMatch.roomId !== roomId ||
          roomMatch.status !== "SCHEDULED" ||
          roomMatch.homeScore !== null ||
          roomMatch.awayScore !== null ||
          roomMatch._count.predictions !== 0;
        if (unsafeExistingState) {
          fatalIssues.push(
            `${roomMatch.id}: no se puede actualizar por status, marcador, sala o predictions.`,
          );
          action = "SALTAR_PROTEGIDO";
        } else {
          const alreadyReady =
            sameTeams(roomMatch, proposedHome, proposedAway) &&
            roomMatch.startsAt.toISOString() === fixture.startsAt &&
            roomMatch.group === "Round of 16" &&
            roomMatch.competitionId === competitionId &&
            roomMatch.isPublished === false;
          action = alreadyReady ? "SIN_CAMBIO" : "ACTUALIZAR";
          if (!alreadyReady) {
            plannedChanges.push({
              kind: "update",
              fixture,
              current: roomMatch,
              homeTeam: proposedHome,
              awayTeam: proposedAway,
            });
          }
        }
      } else {
        action = "CREAR";
        plannedChanges.push({
          kind: "create",
          fixture,
          homeTeam: proposedHome,
          awayTeam: proposedAway,
        });
      }
    }

    return {
      fixture: fixture.fixture,
      global: `${globalMatch.homeTeam} vs ${globalMatch.awayTeam}`,
      sala: roomMatch ? `${roomMatch.homeTeam} vs ${roomMatch.awayTeam}` : "NO_EXISTE",
      propuesto:
        proposedHome && proposedAway
          ? `${proposedHome} vs ${proposedAway}`
          : "PENDIENTE_DE_RESULTADO",
      fuente: source,
      startsAt: fixture.startsAt,
      accion: action,
    };
  });

  const creates = plannedChanges.filter((change) => change.kind === "create").length;
  const updates = plannedChanges.filter((change) => change.kind === "update").length;
  const skipped = roundOf16Rows.filter((row) => row.accion.startsWith("SALTAR")).length;
  const projectedRoomMatchCount = allRoomRoundOf16.length + creates;
  if (projectedRoomMatchCount !== 8) {
    fatalIssues.push(
      `El plan terminaria con ${projectedRoomMatchCount} partidos Round of 16; se requieren exactamente 8.`,
    );
  }

  console.log(`Sala: ${room.name} (${room.inviteCode})`);
  console.log(`Modo: ${wantsApply ? "APPLY" : "DRY-RUN"}`);
  console.log("\nPartidos Round of 32 auditados:");
  console.table(roundOf32Rows);
  console.log("\nPartidos globales Round of 16 encontrados:");
  console.table(
    allGlobalRoundOf16.map((match) => ({
      id: match.id,
      sourceKey: match.sourceKey,
      partido: `${match.homeTeam} vs ${match.awayTeam}`,
      startsAt: match.startsAt.toISOString(),
      status: match.status,
      publicado: match.isPublished,
      predictions: match._count.predictions,
    })),
  );
  console.log("\nPlan Round of 16 para la sala:");
  console.table(roundOf16Rows);

  console.log("\nDuplicados detectados:");
  if (!roomDuplicates.length && !globalDuplicates.length) {
    console.log("Ninguno.");
  } else {
    console.table(
      [...roomDuplicates, ...globalDuplicates].flat().map((match) => ({
        id: match.id,
        roomId: match.roomId,
        partido: `${match.homeTeam} vs ${match.awayTeam}`,
        startsAt: match.startsAt.toISOString(),
      })),
    );
  }

  if (warnings.length) {
    console.log("\nADVERTENCIAS:");
    for (const warning of warnings) console.log(`- ${warning}`);
  }
  if (pendingResults.length) {
    console.log("\nPENDIENTES:");
    for (const pending of pendingResults) console.log(`- ${pending}`);
  }
  if (fatalIssues.length) {
    console.log("\nRIESGOS CRITICOS:");
    for (const issue of fatalIssues) console.log(`- ${issue}`);
  }

  console.log(
    `\nResumen: ${creates} por crear, ${updates} por actualizar, ${skipped} por saltar, ` +
      `${allRoomRoundOf16.length} existentes.`,
  );

  if (!wantsApply) {
    console.log("DRY-RUN completado. No se escribio ningun dato.");
    if (fatalIssues.length) {
      console.log("El modo apply permanece bloqueado hasta resolver los riesgos criticos.");
    }
    return;
  }

  if (fatalIssues.length) {
    throw new Error("Aplicacion cancelada por riesgos criticos.");
  }
  if (!plannedChanges.length) {
    console.log("No hay cambios seguros por aplicar.");
    await auditFinalState(expectedRoundOf32UpdatedAt);
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const change of plannedChanges) {
      if (change.kind === "create") {
        const existingAtKickoff = await tx.match.count({
          where: {
            roomId,
            group: "Round of 16",
            startsAt: new Date(change.fixture.startsAt),
          },
        });
        if (existingAtKickoff !== 0) {
          throw new Error(
            `R16 ${change.fixture.fixture}: cambio concurrente; ya existe un partido en ese horario.`,
          );
        }
        await tx.match.create({
          data: {
            homeTeam: change.homeTeam,
            awayTeam: change.awayTeam,
            startsAt: new Date(change.fixture.startsAt),
            group: "Round of 16",
            competitionId,
            roomId,
            status: "SCHEDULED",
            homeScore: null,
            awayScore: null,
            isPublished: false,
          },
        });
        continue;
      }

      const updated = await tx.match.updateMany({
        where: {
          id: change.current.id,
          roomId,
          status: "SCHEDULED",
          homeScore: null,
          awayScore: null,
          predictions: { none: {} },
          updatedAt: change.current.updatedAt,
        },
        data: {
          homeTeam: change.homeTeam,
          awayTeam: change.awayTeam,
          startsAt: new Date(change.fixture.startsAt),
          group: "Round of 16",
          competitionId,
          isPublished: false,
        },
      });
      if (updated.count !== 1) {
        throw new Error(
          `${change.current.id}: cambio concurrente; se revierte toda la transaccion.`,
        );
      }
    }
  });

  console.log(`Aplicacion completada: ${creates} creados y ${updates} actualizados.`);
  await auditFinalState(expectedRoundOf32UpdatedAt);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
