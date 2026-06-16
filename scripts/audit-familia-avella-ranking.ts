import { PrismaClient } from "@prisma/client";
import { calculatePredictionPoints, getPredictionOutcome } from "../src/lib/scoring";
import { sameMatchByTeamsAndKickoff, resolveEffectiveMatchScore } from "../src/lib/match-equivalence";
import { hasRankingScore } from "../src/lib/prediction-points";
import { roomMatchForPrediction, roomPredictionPoints } from "../src/lib/room-scoring";
import { roomMatchScopeWhere } from "../src/lib/room-match-scope";
import { uniqueRoomPredictions } from "../src/lib/room-predictions";

const prisma = new PrismaClient();
const roomName = "Familia Avella";

type MatchForAudit = {
  id: string;
  competitionId: string | null;
  roomId: string | null;
  sourceKey: string | null;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date;
  updatedAt: Date;
  homeScore: number | null;
  awayScore: number | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
};

type PredictionForAudit = {
  id: string;
  userId: string;
  matchId: string;
  leagueId: string | null;
  roomKey: string;
  homeScore: number;
  awayScore: number;
  points: number;
  manualPoints: number | null;
  updatedAt: Date;
  match: MatchForAudit;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function matchKey(match: Pick<MatchForAudit, "competitionId" | "homeTeam" | "awayTeam" | "startsAt">) {
  return [
    match.competitionId ?? "NO_COMPETITION",
    normalize(match.homeTeam),
    normalize(match.awayTeam),
    match.startsAt.toISOString().slice(0, 10),
  ].join("|");
}

function timestamp(value: Date | string | null | undefined) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function explain(prediction: { homeScore: number; awayScore: number } | null, match: MatchForAudit) {
  if (!prediction) return { points: 0, explanation: "sin pick" };
  if (match.status !== "FINISHED" || match.homeScore === null || match.awayScore === null) {
    return { points: 0, explanation: "partido no finalizado" };
  }

  const points = calculatePredictionPoints(prediction, {
    homeScore: match.homeScore,
    awayScore: match.awayScore,
  });
  const outcome = getPredictionOutcome(prediction, {
    homeScore: match.homeScore,
    awayScore: match.awayScore,
  });
  const labels = {
    EXACT: "exacto",
    GOAL_DIFFERENCE: "diferencia correcta",
    WINNER: "ganador correcto",
    PARTICIPATION: "participacion",
  };

  return { points, explanation: labels[outcome] };
}

function predictionBelongsToRoom(
  prediction: PredictionForAudit,
  leagueId: string,
  roomScopeMatches: MatchForAudit[],
  ownMatchCount: number,
) {
  if (prediction.leagueId === leagueId || prediction.roomKey === leagueId) return true;
  if (prediction.leagueId !== null || prediction.roomKey !== "GLOBAL") return false;

  return roomScopeMatches.some((candidate) => {
    const candidateBelongsToRoom = candidate.roomId === leagueId;
    const candidateIsAllowedGlobal = ownMatchCount === 0 && candidate.roomId === null;

    return (candidateBelongsToRoom || candidateIsAllowedGlobal) && sameMatchByTeamsAndKickoff(candidate, prediction.match);
  });
}

function pickBestPredictionForMatch(predictions: PredictionForAudit[], leagueId: string) {
  const latestFirst = [...predictions].sort((left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt));
  return (
    latestFirst.find((prediction) => prediction.leagueId === leagueId || prediction.roomKey === leagueId) ??
    latestFirst.find((prediction) => prediction.leagueId === null && prediction.roomKey === "GLOBAL") ??
    null
  );
}

async function main() {
  const league = await prisma.league.findFirst({
    where: { name: { equals: roomName, mode: "insensitive" } },
    include: {
      competition: true,
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              role: true,
              createdAt: true,
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!league) {
    throw new Error(`No encontre la sala "${roomName}".`);
  }

  const memberUsers = league.memberships
    .filter((membership) => membership.user.role !== "ADMIN")
    .map((membership) => ({ ...membership.user, roomRole: membership.role, joinedAt: membership.joinedAt }));
  const memberIds = memberUsers.map((user) => user.id);

  const [ownMatchCount, roomScopeMatches, scoredMatches, allMemberPredictions, allRoomPredictions] = await Promise.all([
    prisma.match.count({ where: { roomId: league.id } }),
    prisma.match.findMany({
      where: roomMatchScopeWhere(league),
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        competitionId: true,
        roomId: true,
        sourceKey: true,
        homeTeam: true,
        awayTeam: true,
        startsAt: true,
        updatedAt: true,
        homeScore: true,
        awayScore: true,
        status: true,
      },
    }),
    prisma.match.findMany({
      where: {
        status: { in: ["LIVE", "FINISHED"] },
        homeScore: { not: null },
        awayScore: { not: null },
      },
      select: {
        id: true,
        competitionId: true,
        roomId: true,
        sourceKey: true,
        homeTeam: true,
        awayTeam: true,
        startsAt: true,
        updatedAt: true,
        homeScore: true,
        awayScore: true,
        status: true,
      },
    }),
    prisma.prediction.findMany({
      where: { userId: { in: memberIds } },
      include: {
        match: {
          select: {
            id: true,
            competitionId: true,
            roomId: true,
            sourceKey: true,
            homeTeam: true,
            awayTeam: true,
            startsAt: true,
            updatedAt: true,
            homeScore: true,
            awayScore: true,
            status: true,
          },
        },
      },
      orderBy: [{ user: { name: "asc" } }, { match: { startsAt: "asc" } }, { updatedAt: "desc" }],
    }),
    prisma.prediction.findMany({
      where: {
        OR: [{ leagueId: league.id }, { roomKey: league.id }],
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
        match: {
          select: {
            id: true,
            competitionId: true,
            roomId: true,
            sourceKey: true,
            homeTeam: true,
            awayTeam: true,
            startsAt: true,
            updatedAt: true,
            homeScore: true,
            awayScore: true,
            status: true,
          },
        },
      },
    }),
  ]);

  const finishedRoomMatches = roomScopeMatches.filter(
    (match) => match.status === "FINISHED" && match.homeScore !== null && match.awayScore !== null,
  );
  const effectiveRoomMatches = roomScopeMatches.map((match) => resolveEffectiveMatchScore(match, scoredMatches));

  const appRankingRows = memberUsers.map((member) => {
    const roomPredictions = allMemberPredictions.filter((prediction) =>
      prediction.userId === member.id &&
      predictionBelongsToRoom(prediction, league.id, roomScopeMatches, ownMatchCount),
    );
    const scopedPredictions = uniqueRoomPredictions(roomPredictions, league.id).map((prediction) => ({
      ...prediction,
      match: roomMatchForPrediction(prediction, effectiveRoomMatches, scoredMatches),
    }));
    const scoredPredictions = scopedPredictions.filter(({ match }) => hasRankingScore(match));
    const points = scopedPredictions.reduce((sum, prediction) => sum + roomPredictionPoints(prediction, prediction.match), 0);
    const exactScores = scoredPredictions.filter(
      ({ homeScore, awayScore, match }) => homeScore === match.homeScore && awayScore === match.awayScore,
    ).length;

    return {
      userId: member.id,
      name: member.name,
      appPoints: points,
      appPicks: scopedPredictions.length,
      appScoredPicks: scoredPredictions.length,
      exactScores,
    };
  });

  const summaryRows = memberUsers.map((member) => {
    const userPredictions = allMemberPredictions.filter((prediction) => prediction.userId === member.id);
    const roomPredictions = userPredictions.filter((prediction) =>
      predictionBelongsToRoom(prediction, league.id, roomScopeMatches, ownMatchCount),
    );
    const totalPicksInRoom = uniqueRoomPredictions(roomPredictions, league.id).length;

    let auditPoints = 0;
    let auditPicksOnFinished = 0;
    const details = finishedRoomMatches.map((match) => {
      const candidates = roomPredictions.filter(
        (prediction) => prediction.matchId === match.id || sameMatchByTeamsAndKickoff(prediction.match, match),
      );
      const prediction = pickBestPredictionForMatch(candidates, league.id);
      if (prediction) auditPicksOnFinished += 1;
      const result = explain(prediction, match);
      auditPoints += result.points;

      return {
        userId: member.id,
        name: member.name,
        matchId: match.id,
        fecha: match.startsAt.toISOString(),
        local: match.homeTeam,
        visitante: match.awayTeam,
        resultado: `${match.homeScore}-${match.awayScore}`,
        status: match.status,
        predictionId: prediction?.id ?? null,
        pick: prediction ? `${prediction.homeScore}-${prediction.awayScore}` : "sin pick",
        points: result.points,
        explanation: result.explanation,
        predictionLeagueId: prediction?.leagueId ?? null,
        predictionRoomKey: prediction?.roomKey ?? null,
        predictionMatchId: prediction?.matchId ?? null,
      };
    });
    const appRow = appRankingRows.find((row) => row.userId === member.id);

    return {
      userId: member.id,
      nombre: member.name,
      email: "no existe campo email en User",
      telefono: member.phone,
      totalPicksGuardadosSala: totalPicksInRoom,
      partidosFinalizadosRevisados: finishedRoomMatches.length,
      picksEnFinalizados: auditPicksOnFinished,
      puntosAuditoria: auditPoints,
      puntosRankingActual: appRow?.appPoints ?? 0,
      diferenciaPuntos: auditPoints - (appRow?.appPoints ?? 0),
      picksRankingActual: appRow?.appPicks ?? 0,
      diferenciaPicks: totalPicksInRoom - (appRow?.appPicks ?? 0),
      details,
    };
  });

  const membersSet = new Set(memberIds);
  const rankingUsersNotMembers = appRankingRows.filter((row) => !membersSet.has(row.userId));
  const membersNotInRanking = memberUsers.filter((member) => !appRankingRows.some((row) => row.userId === member.id));
  const wrongLeagueOrRoomPredictions = allMemberPredictions
    .filter((prediction) => predictionBelongsToRoom(prediction, league.id, roomScopeMatches, ownMatchCount))
    .filter((prediction) => prediction.leagueId !== league.id && prediction.roomKey !== league.id);
  const roomPredictionsFromNonMembers = allRoomPredictions.filter((prediction) => !membersSet.has(prediction.userId));
  const duplicatedMatches = [...roomScopeMatches, ...scoredMatches].reduce<Record<string, MatchForAudit[]>>((groups, match) => {
    const key = matchKey(match);
    groups[key] = [...(groups[key] ?? []), match];
    return groups;
  }, {});
  const duplicateMatchGroups = Object.values(duplicatedMatches)
    .filter((items) => items.length > 1)
    .map((items) => items.map((match) => ({
      id: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      startsAt: match.startsAt.toISOString(),
      status: match.status,
      score: match.homeScore === null || match.awayScore === null ? null : `${match.homeScore}-${match.awayScore}`,
      roomId: match.roomId,
      competitionId: match.competitionId,
      sourceKey: match.sourceKey,
    })));
  const finishedWithoutRoomPick = finishedRoomMatches.filter((match) =>
    !allMemberPredictions.some((prediction) =>
      predictionBelongsToRoom(prediction, league.id, roomScopeMatches, ownMatchCount) &&
      (prediction.matchId === match.id || sameMatchByTeamsAndKickoff(prediction.match, match)),
    ),
  );
  const picksWithoutFinishedMatch = allMemberPredictions.filter((prediction) =>
    predictionBelongsToRoom(prediction, league.id, roomScopeMatches, ownMatchCount) &&
    !finishedRoomMatches.some((match) => prediction.matchId === match.id || sameMatchByTeamsAndKickoff(prediction.match, match)),
  );

  console.log("\nAUDITORIA FAMILIA AVELLA");
  console.log("=========================");
  console.log({
    salaId: league.id,
    salaNombre: league.name,
    inviteCode: league.inviteCode,
    competitionId: league.competitionId,
    ownMatchCount,
    participantes: memberUsers.length,
    partidosScopeSala: roomScopeMatches.length,
    partidosFinalizadosAuditados: finishedRoomMatches.length,
    picksMiembrosLeidos: allMemberPredictions.length,
  });

  console.log("\nRESUMEN POR PARTICIPANTE");
  console.table(summaryRows.map(({ details: _details, ...row }) => row));

  console.log("\nCOMPARACION CONTRA RANKING ACTUAL");
  console.table(summaryRows.map((row) => ({
    userId: row.userId,
    nombre: row.nombre,
    puntosAuditoria: row.puntosAuditoria,
    puntosRankingActual: row.puntosRankingActual,
    diferenciaPuntos: row.diferenciaPuntos,
    picksAuditoria: row.totalPicksGuardadosSala,
    picksRankingActual: row.picksRankingActual,
    diferenciaPicks: row.diferenciaPicks,
  })));

  for (const row of summaryRows) {
    console.log(`\nDETALLE: ${row.nombre} (${row.userId})`);
    console.table(row.details);
  }

  console.log("\nINCONSISTENCIAS DETECTADAS");
  console.log(JSON.stringify({
    participantesQueNoAparecenEnRanking: membersNotInRanking,
    rankingUsuariosNoMiembros: rankingUsersNotMembers,
    picksDeSalaConLeagueORoomIncorrecto: wrongLeagueOrRoomPredictions.map((prediction) => ({
      predictionId: prediction.id,
      userId: prediction.userId,
      matchId: prediction.matchId,
      leagueId: prediction.leagueId,
      roomKey: prediction.roomKey,
      match: `${prediction.match.homeTeam} vs ${prediction.match.awayTeam}`,
      startsAt: prediction.match.startsAt,
    })),
    picksDeNoMiembrosGuardadosEnSala: roomPredictionsFromNonMembers.map((prediction) => ({
      predictionId: prediction.id,
      userId: prediction.userId,
      userName: prediction.user.name,
      leagueId: prediction.leagueId,
      roomKey: prediction.roomKey,
      matchId: prediction.matchId,
      match: `${prediction.match.homeTeam} vs ${prediction.match.awayTeam}`,
    })),
    partidosDuplicadosPorEquiposYFecha: duplicateMatchGroups,
    partidosFinalizadosSinPicksDeSala: finishedWithoutRoomPick.map((match) => ({
      matchId: match.id,
      match: `${match.homeTeam} vs ${match.awayTeam}`,
      startsAt: match.startsAt,
      score: `${match.homeScore}-${match.awayScore}`,
      roomId: match.roomId,
      competitionId: match.competitionId,
    })),
    picksSinPartidoFinalizadoRelacionado: picksWithoutFinishedMatch.map((prediction) => ({
      predictionId: prediction.id,
      userId: prediction.userId,
      matchId: prediction.matchId,
      leagueId: prediction.leagueId,
      roomKey: prediction.roomKey,
      match: `${prediction.match.homeTeam} vs ${prediction.match.awayTeam}`,
      matchStatus: prediction.match.status,
      score: prediction.match.homeScore === null || prediction.match.awayScore === null
        ? null
        : `${prediction.match.homeScore}-${prediction.match.awayScore}`,
    })),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("\nERROR EN AUDITORIA");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
