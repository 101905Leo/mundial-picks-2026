import { PrismaClient } from "@prisma/client";
import { calculatePredictionPoints } from "../src/lib/scoring";
import { sameMatchByTeamsAndKickoff } from "../src/lib/match-equivalence";

const prisma = new PrismaClient();

const roomInviteCode = "MP30MA48";
const roomName = "16avos Mundial 2026";
const competitionId = "competition-world-cup-2026";
const expectedRoomId = "cmqso1l7r0001js04zd47vbbs";
const expectedGlobalMatchId = "cmq7kkpf1002ijp04vin8qv4r";
const expectedRoomMatchId = "cmqso2dp1005fl204zcukwz57";
const expectedSourceKey = "openfootball-worldcup-2026-091-w76-w78";
const expectedHomeTeam = "Brazil";
const expectedAwayTeam = "Norway";
const finalHomeScore = 1;
const finalAwayScore = 2;

type MatchSnapshot = {
  id: string;
  sourceKey: string | null;
  roomId: string | null;
  competitionId: string | null;
  homeTeam: string;
  awayTeam: string;
  group: string | null;
  startsAt: Date;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  homeScore: number | null;
  awayScore: number | null;
  isPublished: boolean;
  updatedAt: Date;
  _count: { predictions: number };
};

type PredictionSnapshot = {
  id: string;
  userId: string;
  matchId: string;
  leagueId: string | null;
  roomKey: string;
  homeScore: number;
  awayScore: number;
  points: number;
  manualPoints: number | null;
  lockedAt: Date | null;
  updatedAt: Date;
  user: { name: string };
};

const matchSelect = {
  id: true,
  sourceKey: true,
  roomId: true,
  competitionId: true,
  homeTeam: true,
  awayTeam: true,
  group: true,
  startsAt: true,
  status: true,
  homeScore: true,
  awayScore: true,
  isPublished: true,
  updatedAt: true,
  _count: { select: { predictions: true } },
} as const;

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
  lockedAt: true,
  updatedAt: true,
  user: { select: { name: true } },
} as const;

function scoreLabel(match: Pick<MatchSnapshot, "homeScore" | "awayScore">) {
  if (match.homeScore === null || match.awayScore === null) return "null-null";
  return `${match.homeScore}-${match.awayScore}`;
}

function matchLabel(match: Pick<MatchSnapshot, "homeTeam" | "awayTeam">) {
  return `${match.homeTeam} vs ${match.awayTeam}`;
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function sameExpectedTeams(match: Pick<MatchSnapshot, "homeTeam" | "awayTeam">) {
  return match.homeTeam === expectedHomeTeam && match.awayTeam === expectedAwayTeam;
}

function expectedPoints(prediction: Pick<PredictionSnapshot, "homeScore" | "awayScore">) {
  return calculatePredictionPoints(
    { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
    { homeScore: finalHomeScore, awayScore: finalAwayScore },
  );
}

function predictionRows(predictions: PredictionSnapshot[]) {
  return predictions
    .map((prediction) => {
      const nextPoints = expectedPoints(prediction);
      return {
        user: prediction.user.name,
        pick: `${prediction.homeScore}-${prediction.awayScore}`,
        pointsAntes: prediction.points,
        pointsDespues: nextPoints,
        cambia: prediction.points !== nextPoints ? "SI" : "NO",
        manualPoints: prediction.manualPoints,
      };
    })
    .sort((left, right) => left.user.localeCompare(right.user));
}

async function loadState() {
  const room = await prisma.league.findUnique({
    where: { inviteCode: roomInviteCode },
    select: { id: true, name: true, inviteCode: true, competitionId: true },
  });

  assert(Boolean(room), `No se encontro la sala ${roomInviteCode}.`);
  assert(room!.id === expectedRoomId, `La sala ${roomInviteCode} no coincide con el ID esperado.`);
  assert(room!.name === roomName, `La sala ${roomInviteCode} no coincide con el nombre esperado.`);
  assert(room!.competitionId === competitionId, `La sala ${roomInviteCode} no tiene competitionId esperado.`);

  const [globalMatch, roomMatch] = await Promise.all([
    prisma.match.findUnique({ where: { id: expectedGlobalMatchId }, select: matchSelect }),
    prisma.match.findUnique({ where: { id: expectedRoomMatchId }, select: matchSelect }),
  ]);

  assert(Boolean(globalMatch), "No se encontro el partido global esperado.");
  assert(Boolean(roomMatch), "No se encontro el partido de sala esperado.");

  return {
    room: room!,
    globalMatch: globalMatch!,
    roomMatch: roomMatch!,
    predictions: await prisma.prediction.findMany({
      where: { matchId: roomMatch!.id },
      select: predictionSelect,
    }),
  };
}

function validateState({
  globalMatch,
  roomMatch,
  predictions,
}: {
  globalMatch: MatchSnapshot;
  roomMatch: MatchSnapshot;
  predictions: PredictionSnapshot[];
}) {
  assert(globalMatch.id === expectedGlobalMatchId, "Global ID inesperado.");
  assert(globalMatch.sourceKey === expectedSourceKey, "Global sourceKey inesperado.");
  assert(globalMatch.roomId === null, "El partido global tiene roomId; se cancela.");
  assert(globalMatch.competitionId === competitionId, "Global competitionId incorrecto.");
  assert(globalMatch.group === "Round of 16", "Global no pertenece a Round of 16.");
  assert(sameExpectedTeams(globalMatch), `Global no es ${expectedHomeTeam} vs ${expectedAwayTeam}.`);
  assert(globalMatch._count.predictions === 0, "El partido global tiene predicciones; no se toca.");

  assert(roomMatch.id === expectedRoomMatchId, "Room match ID inesperado.");
  assert(roomMatch.roomId === expectedRoomId, "El partido de sala pertenece a otra sala.");
  assert(roomMatch.competitionId === competitionId, "Partido de sala competitionId incorrecto.");
  assert(roomMatch.group === "Round of 16", "Partido de sala no pertenece a Round of 16.");
  assert(sameExpectedTeams(roomMatch), `Sala no es ${expectedHomeTeam} vs ${expectedAwayTeam}.`);
  assert(sameMatchByTeamsAndKickoff(globalMatch, roomMatch), "Global y sala no coinciden por equipos + startsAt.");

  const foreignPredictions = predictions.filter(
    (prediction) => prediction.leagueId !== expectedRoomId || prediction.roomKey !== expectedRoomId,
  );
  assert(foreignPredictions.length === 0, "Hay predicciones del partido fuera de la sala esperada.");

  const manualPredictions = predictions.filter((prediction) => prediction.manualPoints !== null);
  assert(manualPredictions.length === 0, "Hay predicciones con manualPoints; se cancela para no pisar ajustes manuales.");
}

function printMatchSummary(label: string, match: MatchSnapshot) {
  console.table([
    {
      tipo: label,
      id: match.id,
      sourceKey: match.sourceKey,
      roomId: match.roomId,
      partido: matchLabel(match),
      startsAt: match.startsAt.toISOString(),
      status: match.status,
      marcador: scoreLabel(match),
      predictions: match._count.predictions,
      updatedAt: match.updatedAt.toISOString(),
    },
  ]);
}

async function printAfterState() {
  const { globalMatch, roomMatch, predictions } = await loadState();
  console.log("\nEstado despues del apply:");
  printMatchSummary("global", globalMatch);
  printMatchSummary("sala", roomMatch);
  console.log("\nPuntos por usuario despues:");
  console.table(predictionRows(predictions));
}

async function main() {
  const wantsApply = process.argv.includes("--apply");
  const state = await loadState();
  validateState(state);

  const predictionPlan = predictionRows(state.predictions);
  const updatesNeeded = predictionPlan.filter((row) => row.cambia === "SI").length;
  const matchNeedsUpdate =
    state.globalMatch.status !== "FINISHED" ||
    state.globalMatch.homeScore !== finalHomeScore ||
    state.globalMatch.awayScore !== finalAwayScore ||
    state.roomMatch.status !== "FINISHED" ||
    state.roomMatch.homeScore !== finalHomeScore ||
    state.roomMatch.awayScore !== finalAwayScore;

  console.log(`Modo: ${wantsApply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Resultado correcto: ${expectedHomeTeam} ${finalHomeScore}-${finalAwayScore} ${expectedAwayTeam}`);
  console.log("\nEstado actual global:");
  printMatchSummary("global", state.globalMatch);
  console.log("\nEstado actual sala:");
  printMatchSummary("sala", state.roomMatch);
  console.log("\nPlan de puntos por usuario:");
  console.table(predictionPlan);
  console.log(
    `\nResumen: ${state.predictions.length} predicciones revisadas, ` +
      `${updatesNeeded} predicciones actualizarian puntos, ` +
      `${matchNeedsUpdate ? "marcadores se corregirian" : "marcadores ya estan correctos"}.`,
  );

  if (!wantsApply) {
    console.log("DRY-RUN completado. No se escribio ningun dato.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const globalUpdated = await tx.match.updateMany({
      where: {
        id: state.globalMatch.id,
        roomId: null,
        updatedAt: state.globalMatch.updatedAt,
      },
      data: {
        status: "FINISHED",
        homeScore: finalHomeScore,
        awayScore: finalAwayScore,
      },
    });
    assert(globalUpdated.count === 1, "Cambio concurrente en global; se revierte.");

    const roomUpdated = await tx.match.updateMany({
      where: {
        id: state.roomMatch.id,
        roomId: expectedRoomId,
        updatedAt: state.roomMatch.updatedAt,
      },
      data: {
        status: "FINISHED",
        homeScore: finalHomeScore,
        awayScore: finalAwayScore,
      },
    });
    assert(roomUpdated.count === 1, "Cambio concurrente en sala; se revierte.");

    for (const prediction of state.predictions) {
      const nextPoints = expectedPoints(prediction);
      if (prediction.points === nextPoints) continue;

      const predictionUpdated = await tx.prediction.updateMany({
        where: {
          id: prediction.id,
          matchId: state.roomMatch.id,
          leagueId: expectedRoomId,
          roomKey: expectedRoomId,
          manualPoints: null,
          updatedAt: prediction.updatedAt,
        },
        data: {
          points: nextPoints,
        },
      });
      assert(predictionUpdated.count === 1, `Cambio concurrente en prediccion ${prediction.id}; se revierte.`);
    }
  });

  console.log("\nApply completado.");
  await printAfterState();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
