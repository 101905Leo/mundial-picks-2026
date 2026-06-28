import { PrismaClient } from "@prisma/client";
import { sameMatchByTeamsAndKickoff } from "../src/lib/match-equivalence";

const prisma = new PrismaClient();

const roomInviteCode = "MP30MA48";
const roomName = "16avos Mundial 2026";
const competitionId = "competition-world-cup-2026";
const applyToken = "MP30MA48";

const matchPairs = [
  {
    roomMatchId: "cmqso2dnt004fl204vbopnx62",
    globalMatchId: "cmq7kkpba0020jp04bmm50kko",
    sourceKey: "openfootball-worldcup-2026-073-2a-2b",
    currentGlobal: ["2A", "2B"],
    startsAt: "2026-06-28T19:00:00.000Z",
  },
  {
    roomMatchId: "cmqso2dnv004hl20400ldtkdu",
    globalMatchId: "cmqxajc450048l104s1d6x68d",
    sourceKey: "openfootball-worldcup-2026-076-brazil-japan",
    currentGlobal: ["Brazil", "Japan"],
    startsAt: "2026-06-29T17:00:00.000Z",
  },
  {
    roomMatchId: "cmqso2dny004jl2043kpeyuvi",
    globalMatchId: "cmqxajc3q0044l104n1puee4v",
    sourceKey: "openfootball-worldcup-2026-074-germany-3a-b-c-d-f",
    currentGlobal: ["Germany", "3A/B/C/D/F"],
    startsAt: "2026-06-29T20:30:00.000Z",
  },
  {
    roomMatchId: "cmqso2do0004ll204mywzzcqm",
    globalMatchId: "cmqxajc3y0046l104jy2lnva2",
    sourceKey: "openfootball-worldcup-2026-075-netherlands-morocco",
    currentGlobal: ["Netherlands", "Morocco"],
    startsAt: "2026-06-30T01:00:00.000Z",
  },
  {
    roomMatchId: "cmqso2do2004nl204ueciu7jm",
    globalMatchId: "cmqxajc4k004cl104pk8gksug",
    sourceKey: "openfootball-worldcup-2026-078-ivory-coast-2i",
    currentGlobal: ["Ivory Coast", "2I"],
    startsAt: "2026-06-30T17:00:00.000Z",
  },
  {
    roomMatchId: "cmqso2do4004pl204ytiwsrd1",
    globalMatchId: "cmq7kkpc40024jp04xlc2b9ct",
    sourceKey: "openfootball-worldcup-2026-077-1i-3c-d-f-g-h",
    currentGlobal: ["1I", "3C/D/F/G/H"],
    startsAt: "2026-06-30T21:00:00.000Z",
  },
  {
    roomMatchId: "cmqso2do6004rl204akavw08z",
    globalMatchId: "cmqxajc4s004el1042ka0i98k",
    sourceKey: "openfootball-worldcup-2026-079-mexico-3c-e-f-h-i",
    currentGlobal: ["Mexico", "3C/E/F/H/I"],
    startsAt: "2026-07-01T01:00:00.000Z",
  },
  {
    roomMatchId: "cmqso2do8004tl204sbw4frih",
    globalMatchId: "cmq7kkpcq0027jp04csk5va05",
    sourceKey: "openfootball-worldcup-2026-080-1l-3e-h-i-j-k",
    currentGlobal: ["1L", "3E/H/I/J/K"],
    startsAt: "2026-07-01T16:00:00.000Z",
  },
  {
    roomMatchId: "cmqso2doa004vl20456fj2lio",
    globalMatchId: "cmq7kkpd40029jp04k6zgnkbi",
    sourceKey: "openfootball-worldcup-2026-082-1g-3a-e-h-i-j",
    currentGlobal: ["1G", "3A/E/H/I/J"],
    startsAt: "2026-07-01T20:00:00.000Z",
  },
  {
    roomMatchId: "cmqso2dod004xl204rptmphzy",
    globalMatchId: "cmqxajc57004il104xhhm18gv",
    sourceKey: "openfootball-worldcup-2026-081-usa-3b-e-f-i-j",
    currentGlobal: ["USA", "3B/E/F/I/J"],
    startsAt: "2026-07-02T00:00:00.000Z",
  },
  {
    roomMatchId: "cmqso2dof004zl204e5ia9esq",
    globalMatchId: "cmq7kkpdj002bjp04pkjaz40g",
    sourceKey: "openfootball-worldcup-2026-084-1h-2j",
    currentGlobal: ["1H", "2J"],
    startsAt: "2026-07-02T19:00:00.000Z",
  },
  {
    roomMatchId: "cmqso2doh0051l204iabcnnmx",
    globalMatchId: "cmq7kkpdc002ajp04iyw9wn1c",
    sourceKey: "openfootball-worldcup-2026-083-2k-2l",
    currentGlobal: ["2K", "2L"],
    startsAt: "2026-07-02T23:00:00.000Z",
  },
  {
    roomMatchId: "cmqso2doj0053l204n3w5x34o",
    globalMatchId: "cmqxajc60004ql104pw3k48gc",
    sourceKey: "openfootball-worldcup-2026-085-switzerland-3e-f-g-i-j",
    currentGlobal: ["Switzerland", "3E/F/G/I/J"],
    startsAt: "2026-07-03T03:00:00.000Z",
  },
  {
    roomMatchId: "cmqso2doq0055l204ofu0nt0x",
    globalMatchId: "cmqxajc6p004wl104e2q5iow1",
    sourceKey: "openfootball-worldcup-2026-088-australia-2g",
    currentGlobal: ["Australia", "2G"],
    startsAt: "2026-07-03T18:00:00.000Z",
  },
  {
    roomMatchId: "cmqso2dos0057l204lumrifyr",
    globalMatchId: "cmq7kkpdy002djp04voyl98dy",
    sourceKey: "openfootball-worldcup-2026-086-1j-2h",
    currentGlobal: ["1J", "2H"],
    startsAt: "2026-07-03T22:00:00.000Z",
  },
  {
    roomMatchId: "cmqso2dou0059l204dtm3nga5",
    globalMatchId: "cmq7kkpe6002ejp04oadmn5q7",
    sourceKey: "openfootball-worldcup-2026-087-1k-3d-e-i-j-l",
    currentGlobal: ["1K", "3D/E/I/J/L"],
    startsAt: "2026-07-04T01:30:00.000Z",
  },
] as const;

function sameTeams(left: { homeTeam: string; awayTeam: string }, homeTeam: string, awayTeam: string) {
  return left.homeTeam === homeTeam && left.awayTeam === awayTeam;
}

async function main() {
  const wantsApply = process.argv.includes("--apply");
  const hasApplyToken = process.env.APPLY_GLOBAL_R32 === applyToken;

  if (wantsApply !== hasApplyToken) {
    throw new Error(
      "Aplicacion bloqueada: --apply y APPLY_GLOBAL_R32=MP30MA48 deben estar presentes juntos.",
    );
  }

  const room = await prisma.league.findUnique({
    where: { inviteCode: roomInviteCode },
    select: { id: true, name: true, competitionId: true },
  });

  if (!room || room.name !== roomName || room.competitionId !== competitionId) {
    throw new Error(`No se encontro exactamente la sala auditada ${roomName} (${roomInviteCode}).`);
  }

  const roomMatchIds = matchPairs.map((pair) => pair.roomMatchId);
  const globalMatchIds = matchPairs.map((pair) => pair.globalMatchId);
  if (
    matchPairs.length !== 16 ||
    new Set(roomMatchIds).size !== 16 ||
    new Set(globalMatchIds).size !== 16
  ) {
    throw new Error("El plan debe contener exactamente 16 pares de IDs unicos.");
  }

  const startsAtValues = matchPairs.map((pair) => new Date(pair.startsAt));
  const [roomMatches, globalTargets, globalsAtRoundOf32Kickoffs] = await Promise.all([
    prisma.match.findMany({
      where: { id: { in: roomMatchIds } },
      select: {
        id: true,
        homeTeam: true,
        awayTeam: true,
        group: true,
        startsAt: true,
        roomId: true,
        competitionId: true,
      },
    }),
    prisma.match.findMany({
      where: { id: { in: globalMatchIds } },
      select: {
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
        roomId: true,
        competitionId: true,
        _count: { select: { predictions: true } },
      },
    }),
    prisma.match.findMany({
      where: {
        roomId: null,
        competitionId,
        startsAt: { in: startsAtValues },
      },
      select: {
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
        _count: { select: { predictions: true } },
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const roomById = new Map(roomMatches.map((match) => [match.id, match]));
  const globalById = new Map(globalTargets.map((match) => [match.id, match]));
  const issues: string[] = [];
  const rows = matchPairs.map((pair) => {
    const roomMatch = roomById.get(pair.roomMatchId);
    const globalMatch = globalById.get(pair.globalMatchId);

    if (!roomMatch) {
      issues.push(`${pair.roomMatchId}: partido de sala no encontrado.`);
      return null;
    }
    if (!globalMatch) {
      issues.push(`${pair.globalMatchId}: partido global no encontrado.`);
      return null;
    }

    if (roomMatch.roomId !== room.id) issues.push(`${roomMatch.id}: no pertenece a MP30MA48.`);
    if (roomMatch.competitionId !== competitionId) issues.push(`${roomMatch.id}: competencia de sala cambio.`);
    if (roomMatch.group !== "Round of 32") issues.push(`${roomMatch.id}: no es Round of 32.`);
    if (roomMatch.startsAt.toISOString() !== pair.startsAt) issues.push(`${roomMatch.id}: startsAt de sala cambio.`);

    if (globalMatch.roomId !== null) issues.push(`${globalMatch.id}: dejo de ser global.`);
    if (globalMatch.competitionId !== competitionId) issues.push(`${globalMatch.id}: competencia global cambio.`);
    if (globalMatch.group !== "Round of 32") issues.push(`${globalMatch.id}: no es Round of 32.`);
    if (globalMatch.sourceKey !== pair.sourceKey) issues.push(`${globalMatch.id}: sourceKey cambio.`);
    if (globalMatch.startsAt.toISOString() !== pair.startsAt) issues.push(`${globalMatch.id}: startsAt global cambio.`);
    if (globalMatch.status !== "SCHEDULED") issues.push(`${globalMatch.id}: status ya no es SCHEDULED.`);
    if (globalMatch.isPublished) issues.push(`${globalMatch.id}: esta publicado.`);
    if (globalMatch.homeScore !== null || globalMatch.awayScore !== null) {
      issues.push(`${globalMatch.id}: ya tiene marcador.`);
    }
    if (globalMatch._count.predictions !== 0) issues.push(`${globalMatch.id}: tiene picks asociados.`);

    const hasExpectedCurrent = sameTeams(globalMatch, pair.currentGlobal[0], pair.currentGlobal[1]);
    const alreadyAligned = sameTeams(globalMatch, roomMatch.homeTeam, roomMatch.awayTeam);
    if (!hasExpectedCurrent && !alreadyAligned) {
      issues.push(`${globalMatch.id}: equipos globales cambiaron desde la auditoria.`);
    }

    const equivalentOtherGlobals = globalsAtRoundOf32Kickoffs.filter(
      (candidate) =>
        candidate.id !== globalMatch.id &&
        sameMatchByTeamsAndKickoff(candidate, {
          ...roomMatch,
          sourceKey: null,
        }),
    );
    if (equivalentOtherGlobals.length) {
      issues.push(
        `${globalMatch.id}: otro global ya equivale al partido de sala (${equivalentOtherGlobals
          .map((candidate) => candidate.id)
          .join(", ")}).`,
      );
    }

    return {
      roomMatchId: roomMatch.id,
      globalMatchId: globalMatch.id,
      globalActual: `${globalMatch.homeTeam} vs ${globalMatch.awayTeam}`,
      salaReal: `${roomMatch.homeTeam} vs ${roomMatch.awayTeam}`,
      startsAt: pair.startsAt,
      accion: alreadyAligned ? "SIN_CAMBIO" : "ACTUALIZAR",
    };
  });

  const duplicateRows = startsAtValues.flatMap((startsAt) => {
    const matchesAtKickoff = globalsAtRoundOf32Kickoffs.filter(
      (match) => match.startsAt.getTime() === startsAt.getTime(),
    );
    if (matchesAtKickoff.length < 2) return [];
    return matchesAtKickoff.map((match) => ({
      startsAt: startsAt.toISOString(),
      globalMatchId: match.id,
      sourceKey: match.sourceKey ?? "(sin sourceKey)",
      partido: `${match.homeTeam} vs ${match.awayTeam}`,
      group: match.group || "(sin grupo)",
      status: match.status,
      marcador:
        match.homeScore === null || match.awayScore === null
          ? "-"
          : `${match.homeScore}-${match.awayScore}`,
      picks: match._count.predictions,
    }));
  });

  console.log(`Sala de referencia: ${room.name} (${roomInviteCode})`);
  console.log(`Modo: ${wantsApply ? "APPLY" : "DRY-RUN"}`);
  console.table(rows.filter((row) => row !== null));
  console.log("\nDuplicados por horario (solo reporte; no se modifican):");
  if (duplicateRows.length) console.table(duplicateRows);
  else console.log("No se encontraron duplicados por horario.");

  if (issues.length) {
    throw new Error(`Validacion cancelada:\n- ${issues.join("\n- ")}`);
  }

  const pendingPairs = matchPairs.filter((pair) => {
    const roomMatch = roomById.get(pair.roomMatchId);
    const globalMatch = globalById.get(pair.globalMatchId);
    return Boolean(
      roomMatch &&
        globalMatch &&
        !sameTeams(globalMatch, roomMatch.homeTeam, roomMatch.awayTeam),
    );
  });

  if (!wantsApply) {
    console.log(`\nDRY-RUN aprobado: ${pendingPairs.length} globales se actualizarian.`);
    console.log("No se escribio ningun dato.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const pair of pendingPairs) {
      const roomMatch = roomById.get(pair.roomMatchId)!;
      const updated = await tx.match.updateMany({
        where: {
          id: pair.globalMatchId,
          sourceKey: pair.sourceKey,
          roomId: null,
          competitionId,
          group: "Round of 32",
          startsAt: new Date(pair.startsAt),
          status: "SCHEDULED",
          isPublished: false,
          homeScore: null,
          awayScore: null,
          homeTeam: pair.currentGlobal[0],
          awayTeam: pair.currentGlobal[1],
          predictions: { none: {} },
        },
        data: {
          homeTeam: roomMatch.homeTeam,
          awayTeam: roomMatch.awayTeam,
        },
      });

      if (updated.count !== 1) {
        throw new Error(
          `${pair.globalMatchId}: cambio concurrente detectado; se revierte toda la transaccion.`,
        );
      }
    }
  });

  console.log(`Actualizacion completada: ${pendingPairs.length} partidos globales alineados.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
