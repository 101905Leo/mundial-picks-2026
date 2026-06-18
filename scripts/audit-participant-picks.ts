import { Prisma, PrismaClient } from "@prisma/client";
import { sameMatchByTeamsAndKickoff } from "../src/lib/match-equivalence";
import { roomPredictionPoints } from "../src/lib/room-scoring";
import { uniqueRoomPredictions } from "../src/lib/room-predictions";

const prisma = new PrismaClient();

const participantFilter = readArg("--participant");
const roomFilter = readArg("--room");
const roomCodeFilter = readArg("--code");

type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED";

type MatchAudit = {
  id: string;
  competitionId: string | null;
  sourceKey: string | null;
  roomId: string | null;
  homeTeam: string;
  awayTeam: string;
  group: string | null;
  startsAt: Date;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
};

type PredictionAudit = {
  id: string;
  userId: string;
  matchId: string;
  leagueId: string | null;
  roomKey: string;
  homeScore: number;
  awayScore: number;
  points: number;
  manualPoints: number | null;
  createdAt: Date;
  updatedAt: Date;
  match: MatchAudit;
};

type PickRow = {
  partido: string;
  fecha: string;
  estado: MatchStatus;
  resultado: string;
  pick: string;
  predictionId: string;
  matchId: string;
  leagueId: string;
  roomKey: string;
  matchRoomId: string;
  puntosGuardados: number;
  puntosCalculados: number;
  tipo: "definitivo" | "provisional" | "no cuenta";
  motivo: string;
  observacion: string;
};

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function scoreText(match: Pick<MatchAudit, "homeScore" | "awayScore">) {
  return match.homeScore === null || match.awayScore === null ? "-" : `${match.homeScore}-${match.awayScore}`;
}

function pickText(prediction: Pick<PredictionAudit, "homeScore" | "awayScore"> | null) {
  return prediction ? `${prediction.homeScore}-${prediction.awayScore}` : "-";
}

function matchText(match: Pick<MatchAudit, "homeTeam" | "awayTeam">) {
  return `${match.homeTeam} vs ${match.awayTeam}`;
}

function outcomeReason(prediction: Pick<PredictionAudit, "homeScore" | "awayScore"> | null, match: MatchAudit) {
  if (!prediction) return "Sin pick";
  if (match.status === "SCHEDULED") return "Partido no finalizado";
  if (match.homeScore === null || match.awayScore === null) return "Partido sin marcador real";

  const exact = prediction.homeScore === match.homeScore && prediction.awayScore === match.awayScore;
  if (exact) return "Exacto";

  const pickDiff = prediction.homeScore - prediction.awayScore;
  const realDiff = match.homeScore - match.awayScore;
  if (pickDiff === realDiff) return "Diferencia correcta";

  const pickWinner = prediction.homeScore > prediction.awayScore ? "HOME" : prediction.homeScore < prediction.awayScore ? "AWAY" : "DRAW";
  const realWinner = match.homeScore > match.awayScore ? "HOME" : match.homeScore < match.awayScore ? "AWAY" : "DRAW";
  if (pickWinner === realWinner) return "Ganador correcto";

  return "Participación";
}

function pointsFor(prediction: Pick<PredictionAudit, "homeScore" | "awayScore"> | null, match: MatchAudit) {
  if (!prediction) return 0;
  return roomPredictionPoints(prediction, match);
}

function isStrictRoomPick(prediction: PredictionAudit, roomId: string) {
  return (
    (prediction.leagueId === roomId || prediction.roomKey === roomId) &&
    prediction.match.roomId === roomId
  );
}

function findEquivalentRoomMatches(source: MatchAudit, roomMatches: MatchAudit[]) {
  return roomMatches.filter((roomMatch) => sameMatchByTeamsAndKickoff(roomMatch, source));
}

async function findParticipant() {
  if (!participantFilter) {
    throw new Error('Debes enviar --participant "Nombre o telefono".');
  }

  const normalizedFilter = normalize(participantFilter);
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: participantFilter, mode: "insensitive" } },
        { phone: { contains: participantFilter } },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const exactMatches = users.filter((user) => normalize(user.name) === normalizedFilter || user.phone === participantFilter);
  const candidates = exactMatches.length ? exactMatches : users;

  if (candidates.length === 0) {
    console.log(`No encontré participantes parecidos a: ${participantFilter}`);
    return null;
  }

  if (candidates.length > 1) {
    console.log("Encontré varias coincidencias. No asumí ninguna:");
    console.table(
      candidates.map((user) => ({
        userId: user.id,
        nombre: user.name,
        telefono: user.phone,
        rol: user.role,
        creado: user.createdAt.toISOString(),
      })),
    );
    return null;
  }

  return candidates[0];
}

async function auditRoom(user: NonNullable<Awaited<ReturnType<typeof findParticipant>>>, roomId: string) {
  const room = await prisma.league.findUnique({
    where: { id: roomId },
    include: {
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
              predictions: {
                select: predictionSelect,
              },
            },
          },
        },
      },
    },
  });

  if (!room) return null;
  const membership = room.memberships.find((item) => item.userId === user.id);
  if (!membership) return null;

  const roomMatches = await prisma.match.findMany({
    where: { roomId: room.id },
    select: matchSelect,
    orderBy: { startsAt: "asc" },
  });
  const roomMatchById = new Map(roomMatches.map((match) => [match.id, match]));
  const participant = room.memberships.find((item) => item.userId === user.id)!.user;
  const strictPredictions = participant.predictions.filter((prediction) => isStrictRoomPick(prediction, room.id));
  const scopedPredictions = uniqueRoomPredictions(strictPredictions, room.id).map((prediction) => ({
    ...prediction,
    match: roomMatchById.get(prediction.match.id) ?? prediction.match,
  }));
  const scopedByMatchId = new Map(scopedPredictions.map((prediction) => [prediction.match.id, prediction]));
  const rankingPoints = scopedPredictions.reduce((sum, prediction) => sum + roomPredictionPoints(prediction, prediction.match), 0);
  const finishedPoints = scopedPredictions
    .filter((prediction) => prediction.match.status === "FINISHED")
    .reduce((sum, prediction) => sum + roomPredictionPoints(prediction, prediction.match), 0);
  const provisionalPoints = rankingPoints - finishedPoints;

  const allMemberRows = room.memberships
    .filter((item) => item.user.role !== "ADMIN")
    .map(({ user: member }) => {
      const roomPredictions = member.predictions.filter((prediction) => isStrictRoomPick(prediction, room.id));
      const uniquePredictions = uniqueRoomPredictions(roomPredictions, room.id).map((prediction) => ({
        ...prediction,
        match: roomMatchById.get(prediction.match.id) ?? prediction.match,
      }));
      const exactScores = uniquePredictions.filter(
        (prediction) =>
          prediction.match.status === "FINISHED" &&
          prediction.match.homeScore === prediction.homeScore &&
          prediction.match.awayScore === prediction.awayScore,
      ).length;

      return {
        id: member.id,
        name: member.name,
        points: uniquePredictions.reduce((sum, prediction) => sum + roomPredictionPoints(prediction, prediction.match), 0),
        predictions: uniquePredictions.length,
        exactScores,
      };
    })
    .sort((left, right) => right.points - left.points || right.exactScores - left.exactScores || right.predictions - left.predictions);

  const rankingEntry = allMemberRows.find((entry) => entry.id === user.id) ?? null;
  const pickRows = buildPickRows(roomMatches, scopedByMatchId, room.id);
  const diagnostics = await buildDiagnostics(user.id, room.id, roomMatches, participant.predictions);

  return {
    room,
    membershipRole: membership.role,
    rankingEntry,
    rankingPoints,
    finishedPoints,
    provisionalPoints,
    pickRows,
    diagnostics,
  };
}

function buildPickRows(roomMatches: MatchAudit[], scopedByMatchId: Map<string, PredictionAudit>, roomId: string) {
  return roomMatches.map<PickRow>((match) => {
    const prediction = scopedByMatchId.get(match.id) ?? null;
    const calculated = pointsFor(prediction, match);
    const stored = prediction?.points ?? 0;
    const type = match.status === "FINISHED" ? "definitivo" : match.status === "LIVE" ? "provisional" : "no cuenta";
    const observations: string[] = [];

    if (!prediction) observations.push("No hay pick para este partido de la sala.");
    if (prediction && prediction.leagueId !== roomId && prediction.roomKey !== roomId) observations.push("El pick no está marcado para esta sala.");
    if (prediction && prediction.match.roomId !== roomId) observations.push("El pick apunta a un partido fuera de la sala.");
    if (prediction && stored !== calculated) observations.push(`Guardado ${stored}, calculado ${calculated}.`);
    if (match.status === "SCHEDULED") observations.push("No suma puntos definitivos.");
    if (match.status === "LIVE") observations.push("Puntos provisionales.");

    return {
      partido: matchText(match),
      fecha: match.startsAt.toISOString(),
      estado: match.status,
      resultado: scoreText(match),
      pick: pickText(prediction),
      predictionId: prediction?.id ?? "",
      matchId: match.id,
      leagueId: prediction?.leagueId ?? "null",
      roomKey: prediction?.roomKey ?? "",
      matchRoomId: prediction?.match.roomId ?? "null",
      puntosGuardados: stored,
      puntosCalculados: calculated,
      tipo: type,
      motivo: outcomeReason(prediction, match),
      observacion: observations.join(" "),
    };
  });
}

async function buildDiagnostics(userId: string, roomId: string, roomMatches: MatchAudit[], predictions: PredictionAudit[]) {
  const duplicateGroups = new Map<string, PredictionAudit[]>();
  for (const prediction of predictions) {
    const key = `${prediction.matchId}:${prediction.roomKey}`;
    duplicateGroups.set(key, [...(duplicateGroups.get(key) ?? []), prediction]);
  }

  const duplicates = [...duplicateGroups.values()].filter((items) => items.length > 1);
  const globalCandidates = predictions.filter(
    (prediction) =>
      prediction.leagueId === null &&
      prediction.roomKey === "GLOBAL" &&
      prediction.match.roomId === null &&
      findEquivalentRoomMatches(prediction.match, roomMatches).length > 0,
  );
  const wrongLeague = predictions.filter(
    (prediction) =>
      prediction.leagueId !== null &&
      prediction.leagueId !== roomId &&
      prediction.roomKey !== roomId,
  );
  const wrongMatch = predictions.filter(
    (prediction) =>
      (prediction.leagueId === roomId || prediction.roomKey === roomId) &&
      prediction.match.roomId !== roomId,
  );
  const finishedWithoutStoredPoints = predictions.filter(
    (prediction) =>
      isStrictRoomPick(prediction, roomId) &&
      prediction.match.status === "FINISHED" &&
      roomPredictionPoints(prediction, prediction.match) !== prediction.points,
  );
  const finishedRoomMatchesWithoutPick = roomMatches.filter(
    (match) =>
      match.status === "FINISHED" &&
      !predictions.some((prediction) => isStrictRoomPick(prediction, roomId) && prediction.matchId === match.id),
  );

  const equivalentRows = globalCandidates.map((prediction) => {
    const equivalents = findEquivalentRoomMatches(prediction.match, roomMatches);
    return {
      predictionId: prediction.id,
      origen: `${matchText(prediction.match)} · ${prediction.match.startsAt.toISOString()}`,
      pick: pickText(prediction),
      equivalentesSala: equivalents.map((match) => `${match.id} · ${matchText(match)} · ${match.startsAt.toISOString()}`).join(" | "),
    };
  });

  return {
    userId,
    duplicates,
    globalCandidates,
    equivalentRows,
    wrongLeague,
    wrongMatch,
    finishedWithoutStoredPoints,
    finishedRoomMatchesWithoutPick,
  };
}

async function main() {
  const user = await findParticipant();
  if (!user) return;

  const memberships = await prisma.leagueMembership.findMany({
    where: {
      userId: user.id,
      league: {
        ...(roomFilter ? { name: { contains: roomFilter, mode: "insensitive" } } : {}),
        ...(roomCodeFilter ? { inviteCode: { equals: roomCodeFilter, mode: "insensitive" } } : {}),
      },
    },
    include: {
      league: {
        select: {
          id: true,
          name: true,
          inviteCode: true,
          status: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  console.log("Participante:");
  console.table([
    {
      userId: user.id,
      nombre: user.name,
      telefono: user.phone,
      rol: user.role,
    },
  ]);

  if (memberships.length === 0) {
    console.log("No encontré salas para este participante con los filtros enviados.");
    return;
  }

  console.log("Salas encontradas:");
  console.table(
    memberships.map((membership) => ({
      salaId: membership.league.id,
      sala: membership.league.name,
      codigo: membership.league.inviteCode,
      estado: membership.league.status,
      rolEnSala: membership.role,
    })),
  );

  for (const membership of memberships) {
    const audit = await auditRoom(user, membership.league.id);
    if (!audit) continue;
    const rankingPoints = audit.rankingEntry?.points ?? 0;
    const difference = audit.rankingPoints - rankingPoints;

    console.log("");
    console.log(`Sala: ${audit.room.name} · Código: ${audit.room.inviteCode}`);
    console.table([
      {
        participante: user.name,
        rolEnSala: audit.membershipRole,
        puntosActualesRanking: rankingPoints,
        puntosCalculadosRanking: audit.rankingPoints,
        puntosDefinitivosFinished: audit.finishedPoints,
        puntosProvisionalesLive: audit.provisionalPoints,
        diferenciaContraRanking: difference,
        picksEnSala: audit.pickRows.filter((row) => row.predictionId).length,
        partidosSala: audit.pickRows.length,
      },
    ]);

    console.log("Tabla de picks:");
    console.table(
      audit.pickRows.map((row) => ({
        Partido: row.partido,
        Resultado: row.resultado,
        Pick: row.pick,
        Estado: row.estado,
        PuntosGuardados: row.puntosGuardados,
        PuntosCalculados: row.puntosCalculados,
        Motivo: row.motivo,
        Observacion: row.observacion,
      })),
    );

    printDiagnostics(audit.diagnostics);

    const hasMismatch =
      difference !== 0 ||
      audit.diagnostics.globalCandidates.length > 0 ||
      audit.diagnostics.wrongLeague.length > 0 ||
      audit.diagnostics.wrongMatch.length > 0 ||
      audit.diagnostics.finishedWithoutStoredPoints.length > 0;

    console.log("Diagnóstico:");
    console.table([
      {
        estado: hasMismatch ? "No coincide / requiere revisión" : "Coincide",
        posibleCausa: possibleCause(audit),
        recomendacion: recommendation(audit),
      },
    ]);
  }
}

function printDiagnostics(diagnostics: Awaited<ReturnType<typeof buildDiagnostics>>) {
  console.log("Problemas comunes detectados:");
  console.table([
    {
      picksDuplicados: diagnostics.duplicates.length,
      picksGlobalesConEquivalenteEnSala: diagnostics.globalCandidates.length,
      picksConLeagueIdIncorrecto: diagnostics.wrongLeague.length,
      picksMarcadosSalaPeroPartidoFuera: diagnostics.wrongMatch.length,
      finalizadosConPuntosGuardadosDistintos: diagnostics.finishedWithoutStoredPoints.length,
      partidosFinalizadosSinPickSala: diagnostics.finishedRoomMatchesWithoutPick.length,
    },
  ]);

  if (diagnostics.equivalentRows.length > 0) {
    console.log("Picks GLOBAL que parecen pertenecer a esta sala:");
    console.table(diagnostics.equivalentRows);
  }

  if (diagnostics.wrongLeague.length > 0) {
    console.log("Picks con leagueId/roomKey de otra sala:");
    console.table(
      diagnostics.wrongLeague.map((prediction) => ({
        predictionId: prediction.id,
        partido: matchText(prediction.match),
        pick: pickText(prediction),
        leagueId: prediction.leagueId ?? "null",
        roomKey: prediction.roomKey,
        matchRoomId: prediction.match.roomId ?? "GLOBAL",
      })),
    );
  }

  if (diagnostics.wrongMatch.length > 0) {
    console.log("Picks marcados como sala pero asociados a partido fuera de esa sala:");
    console.table(
      diagnostics.wrongMatch.map((prediction) => ({
        predictionId: prediction.id,
        partido: matchText(prediction.match),
        pick: pickText(prediction),
        leagueId: prediction.leagueId ?? "null",
        roomKey: prediction.roomKey,
        matchRoomId: prediction.match.roomId ?? "GLOBAL",
      })),
    );
  }
}

function possibleCause(audit: NonNullable<Awaited<ReturnType<typeof auditRoom>>>) {
  if (audit.diagnostics.globalCandidates.length > 0) {
    return "Hay picks historicos guardados como GLOBAL que tienen partido equivalente en la sala.";
  }
  if (audit.diagnostics.wrongMatch.length > 0) {
    return "Hay picks de sala apuntando a partido global o de otra sala.";
  }
  if (audit.diagnostics.wrongLeague.length > 0) {
    return "Hay picks con leagueId/roomKey de otra sala.";
  }
  if (audit.diagnostics.finishedWithoutStoredPoints.length > 0) {
    return "Los puntos guardados en Prediction.points no coinciden con el calculo actual.";
  }
  return "No se detectó diferencia estructural con los filtros actuales de sala.";
}

function recommendation(audit: NonNullable<Awaited<ReturnType<typeof auditRoom>>>) {
  if (audit.diagnostics.globalCandidates.length > 0 || audit.diagnostics.wrongMatch.length > 0) {
    return "Revisar migracion segura de picks historicos hacia el partido propio de la sala; no aplicar cambios automaticos desde esta auditoria.";
  }
  if (audit.diagnostics.finishedWithoutStoredPoints.length > 0) {
    return "Recalcular con la herramienta existente solo después de confirmar que los picks pertenecen a la sala correcta.";
  }
  return "No corregir datos; verificar con el participante si esperaba incluir picks de otra sala o picks globales.";
}

const matchSelect = {
  id: true,
  competitionId: true,
  sourceKey: true,
  roomId: true,
  homeTeam: true,
  awayTeam: true,
  group: true,
  startsAt: true,
  status: true,
  homeScore: true,
  awayScore: true,
} satisfies Prisma.MatchSelect;

const predictionSelect = {
  id: true,
  userId: true,
  matchId: true,
  leagueId: true,
  roomKey: true,
  homeScore: true,
  awayScore: true,
  points: true,
  manualPoints: true,
  createdAt: true,
  updatedAt: true,
  match: { select: matchSelect },
} satisfies Prisma.PredictionSelect;

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
