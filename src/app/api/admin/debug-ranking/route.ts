import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { calculatePredictionPoints } from "@/lib/scoring";
import { matchBelongsToResolvedRoomScope, roomOwnedMatchWhere } from "@/lib/room-match-scope";
import { normalizeTeamName, resolveEffectiveMatchScore, sameMatchByTeamsAndKickoff } from "@/lib/match-equivalence";
import { uniqueRoomPredictions } from "@/lib/room-predictions";

type MatchSnapshot = {
  id: string;
  sourceKey: string | null;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date;
  updatedAt: Date;
  homeScore: number | null;
  awayScore: number | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  isPublished: boolean;
  roomId: string | null;
  competitionId: string | null;
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
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    phone: string;
    role: "USER" | "ADMIN";
    createdAt: Date;
  };
  match: MatchSnapshot;
};

type RoomSnapshot = {
  id: string;
  name: string;
  inviteCode: string;
  competitionId: string | null;
  memberships: {
    userId: string;
    role: "MEMBER" | "ADMIN";
    user: {
      id: string;
      name: string;
      phone: string;
      role: "USER" | "ADMIN";
      createdAt: Date;
    };
  }[];
};

function isFinishedWithScore(match: Pick<MatchSnapshot, "status" | "homeScore" | "awayScore">) {
  return match.status === "FINISHED" && match.homeScore !== null && match.awayScore !== null;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function logicalMatchKey(match: Pick<MatchSnapshot, "competitionId" | "homeTeam" | "awayTeam" | "startsAt">) {
  return [
    match.competitionId ?? "NO_COMPETITION",
    normalizeTeamName(match.homeTeam),
    normalizeTeamName(match.awayTeam),
    dateKey(match.startsAt),
  ].join("|");
}

function matchSummary(match: MatchSnapshot) {
  return {
    matchId: match.id,
    sourceKey: match.sourceKey,
    roomId: match.roomId,
    competitionId: match.competitionId,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    startsAt: match.startsAt,
    status: match.status,
    isPublished: match.isPublished,
    result: {
      homeScore: match.homeScore,
      awayScore: match.awayScore,
    },
  };
}

function predictionSummary(
  prediction: PredictionSnapshot,
  effectiveMatch: MatchSnapshot,
  reason: string,
  counted: boolean,
) {
  const calculatedPoints = isFinishedWithScore(effectiveMatch)
    ? calculatePredictionPoints(
        { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
        { homeScore: effectiveMatch.homeScore!, awayScore: effectiveMatch.awayScore! },
      )
    : null;

  return {
    predictionId: prediction.id,
    matchId: prediction.matchId,
    effectiveMatchId: effectiveMatch.id,
    userId: prediction.userId,
    userName: prediction.user.name,
    phone: prediction.user.phone,
    roomKey: prediction.roomKey,
    leagueId: prediction.leagueId,
    homeTeam: effectiveMatch.homeTeam,
    awayTeam: effectiveMatch.awayTeam,
    pick: {
      homeScore: prediction.homeScore,
      awayScore: prediction.awayScore,
    },
    result: {
      homeScore: effectiveMatch.homeScore,
      awayScore: effectiveMatch.awayScore,
    },
    status: effectiveMatch.status,
    originalMatch: matchSummary(prediction.match),
    pointsStoredInDb: prediction.points,
    manualPointsStoredInDb: prediction.manualPoints,
    calculatedPoints,
    counted,
    reason,
  };
}

function ignoreReasonForFinalStatus(match: MatchSnapshot) {
  if (match.status !== "FINISHED") return "partido no está FINISHED";
  if (match.homeScore === null || match.awayScore === null) return "partido no tiene resultado completo";
  return null;
}

function sortRanking<T extends { totalCalculatedPoints: number; countedPredictions: unknown[]; userCreatedAt: Date }>(
  rows: T[],
) {
  return rows.sort(
    (left, right) =>
      right.totalCalculatedPoints - left.totalCalculatedPoints ||
      right.countedPredictions.length - left.countedPredictions.length ||
      left.userCreatedAt.getTime() - right.userCreatedAt.getTime(),
  );
}

function buildGlobalRankingDiagnostics(users: RoomSnapshot["memberships"][number]["user"][], predictions: PredictionSnapshot[]) {
  const rows = users
    .filter((user) => user.role === "USER")
    .map((user) => {
      const userPredictions = predictions.filter((prediction) => prediction.userId === user.id);
      const countedPredictions = [];
      const ignoredPredictions = [];

      for (const prediction of userPredictions) {
        if (prediction.roomKey !== "GLOBAL" || prediction.leagueId !== null) {
          ignoredPredictions.push(
            predictionSummary(prediction, prediction.match, "predicción pertenece a una sala, no al ranking global", false),
          );
          continue;
        }

        if (!prediction.match.isPublished) {
          ignoredPredictions.push(
            predictionSummary(prediction, prediction.match, "match global no está publicado", false),
          );
          continue;
        }

        const finalStatusReason = ignoreReasonForFinalStatus(prediction.match);
        if (finalStatusReason) {
          ignoredPredictions.push(predictionSummary(prediction, prediction.match, finalStatusReason, false));
          continue;
        }

        countedPredictions.push(
          predictionSummary(
            prediction,
            prediction.match,
            "cuenta porque es GLOBAL, el partido está publicado, FINISHED y con marcador completo",
            true,
          ),
        );
      }

      return {
        userId: user.id,
        name: user.name,
        phone: user.phone,
        userCreatedAt: user.createdAt,
        totalCalculatedPoints: countedPredictions.reduce((sum, item) => sum + (item.calculatedPoints ?? 0), 0),
        countedPredictions,
        ignoredPredictions,
      };
    });

  return sortRanking(rows);
}

async function buildRoomRankingDiagnostics(room: RoomSnapshot, predictions: PredictionSnapshot[], allMatches: MatchSnapshot[]) {
  const ownPublishedMatches = await prisma.match.count({
    where: { isPublished: true, ...roomOwnedMatchWhere(room) },
  });
  const useOwnedMatchesOnly = ownPublishedMatches > 0;
  const scoredMatches = allMatches.filter(isFinishedWithScore);
  const members = room.memberships.filter((membership) => membership.user.role !== "ADMIN");
  const memberIds = new Set(members.map((membership) => membership.userId));
  const selectedPredictionIdsByUser = new Map<string, Set<string>>();
  const candidatePredictionIdsByUser = new Map<string, Set<string>>();

  for (const membership of members) {
    const userPredictions = predictions.filter((prediction) => prediction.userId === membership.userId);
    const candidatePredictions = userPredictions.filter((prediction) => {
      const belongsToSelectedRoom = prediction.leagueId === room.id || prediction.roomKey === room.id;
      const belongsToGlobalFallback =
        prediction.leagueId === null &&
        prediction.roomKey === "GLOBAL" &&
        matchBelongsToResolvedRoomScope(prediction.match, room, useOwnedMatchesOnly);
      const hasEquivalentScore = scoredMatches.some((candidate) => sameMatchByTeamsAndKickoff(candidate, prediction.match));

      return (prediction.match.isPublished || hasEquivalentScore) && (belongsToSelectedRoom || belongsToGlobalFallback);
    });

    candidatePredictionIdsByUser.set(membership.userId, new Set(candidatePredictions.map((prediction) => prediction.id)));
    selectedPredictionIdsByUser.set(
      membership.userId,
      new Set(uniqueRoomPredictions(candidatePredictions, room.id).map((prediction) => prediction.id)),
    );
  }

  const rows = members.map((membership) => {
    const userPredictions = predictions.filter((prediction) => prediction.userId === membership.userId);
    const countedPredictions = [];
    const ignoredPredictions = [];
    const selectedPredictionIds = selectedPredictionIdsByUser.get(membership.userId) ?? new Set<string>();
    const candidatePredictionIds = candidatePredictionIdsByUser.get(membership.userId) ?? new Set<string>();

    for (const prediction of userPredictions) {
      const belongsToSelectedRoom = prediction.leagueId === room.id || prediction.roomKey === room.id;
      const belongsToGlobalFallback =
        prediction.leagueId === null &&
        prediction.roomKey === "GLOBAL" &&
        matchBelongsToResolvedRoomScope(prediction.match, room, useOwnedMatchesOnly);
      const effectiveMatch = resolveEffectiveMatchScore(prediction.match, scoredMatches);
      const finalStatusReason = ignoreReasonForFinalStatus(effectiveMatch);

      if (!belongsToSelectedRoom && !belongsToGlobalFallback) {
        ignoredPredictions.push(
          predictionSummary(
            prediction,
            effectiveMatch,
            prediction.leagueId && prediction.leagueId !== room.id
              ? "predicción pertenece a otra leagueId"
              : "predicción pertenece a otro roomKey o no coincide con el alcance de la sala",
            false,
          ),
        );
        continue;
      }

      if (!candidatePredictionIds.has(prediction.id)) {
        ignoredPredictions.push(
          predictionSummary(prediction, effectiveMatch, "match duplicado o no coincide con el match de la sala", false),
        );
        continue;
      }

      if (!selectedPredictionIds.has(prediction.id)) {
        ignoredPredictions.push(
          predictionSummary(
            prediction,
            effectiveMatch,
            "match duplicado: el ranking eligió otra predicción para el mismo partido lógico",
            false,
          ),
        );
        continue;
      }

      if (finalStatusReason) {
        ignoredPredictions.push(predictionSummary(prediction, effectiveMatch, finalStatusReason, false));
        continue;
      }

      countedPredictions.push(
        predictionSummary(
          prediction,
          effectiveMatch,
          "cuenta porque pertenece a la sala o fallback GLOBAL válido, el partido está FINISHED y con marcador completo",
          true,
        ),
      );
    }

    return {
      userId: membership.user.id,
      name: membership.user.name,
      phone: membership.user.phone,
      roomRole: membership.role,
      userCreatedAt: membership.user.createdAt,
      totalCalculatedPoints: countedPredictions.reduce((sum, item) => sum + (item.calculatedPoints ?? 0), 0),
      countedPredictions,
      ignoredPredictions,
    };
  });

  const nonMemberPredictions = predictions
    .filter((prediction) => !memberIds.has(prediction.userId) && (prediction.leagueId === room.id || prediction.roomKey === room.id))
    .map((prediction) =>
      predictionSummary(prediction, resolveEffectiveMatchScore(prediction.match, scoredMatches), "usuario no pertenece a la sala", false),
    );

  const membersWithoutPredictions = members
    .filter((membership) => (candidatePredictionIdsByUser.get(membership.userId)?.size ?? 0) === 0)
    .map((membership) => ({
      userId: membership.user.id,
      name: membership.user.name,
      phone: membership.user.phone,
      roomRole: membership.role,
      reason: "usuario miembro de sala sin predicciones candidatas para esta sala",
    }));

  const roomMatches = allMatches.filter((match) => matchBelongsToResolvedRoomScope(match, room, useOwnedMatchesOnly));
  const finishedMatchesWithoutPicks = roomMatches
    .filter(isFinishedWithScore)
    .filter(
      (match) =>
        !predictions.some(
          (prediction) =>
            memberIds.has(prediction.userId) &&
            sameMatchByTeamsAndKickoff(prediction.match, match) &&
            (prediction.leagueId === room.id ||
              prediction.roomKey === room.id ||
              (prediction.leagueId === null && prediction.roomKey === "GLOBAL")),
        ),
    )
    .map(matchSummary);

  const picksWithoutFinishedResult = predictions
    .filter((prediction) => memberIds.has(prediction.userId))
    .filter((prediction) => prediction.leagueId === room.id || prediction.roomKey === room.id)
    .filter((prediction) => {
      const effectiveMatch = resolveEffectiveMatchScore(prediction.match, scoredMatches);
      return !isFinishedWithScore(effectiveMatch);
    })
    .map((prediction) =>
      predictionSummary(
        prediction,
        resolveEffectiveMatchScore(prediction.match, scoredMatches),
        "pick asociado a partido que no tiene resultado FINISHED completo",
        false,
      ),
    );

  return {
    roomId: room.id,
    name: room.name,
    inviteCode: room.inviteCode,
    competitionId: room.competitionId,
    useOwnedMatchesOnly,
    ranking: sortRanking(rows),
    inconsistencies: {
      membersWithoutPredictions,
      predictionsFromNonMembers: nonMemberPredictions,
      finishedMatchesWithoutPicks,
      picksWithoutFinishedResult,
    },
  };
}

function buildDuplicateMatchDiagnostics(matches: MatchSnapshot[]) {
  const grouped = new Map<string, MatchSnapshot[]>();
  for (const match of matches) {
    const key = logicalMatchKey(match);
    grouped.set(key, [...(grouped.get(key) ?? []), match]);
  }

  return [...grouped.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      key,
      reason: "partidos con mismos equipos y fecha pero diferente id",
      matches: items.map(matchSummary),
    }));
}

function buildDuplicatePredictionDiagnostics(predictions: PredictionSnapshot[]) {
  const grouped = new Map<string, PredictionSnapshot[]>();
  for (const prediction of predictions) {
    const key = [prediction.userId, prediction.roomKey, prediction.leagueId ?? "NO_LEAGUE", logicalMatchKey(prediction.match)].join("|");
    grouped.set(key, [...(grouped.get(key) ?? []), prediction]);
  }

  return [...grouped.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      key,
      reason: "predicciones duplicadas para el mismo usuario, sala y partido lógico",
      predictions: items.map((prediction) => predictionSummary(prediction, prediction.match, "duplicado detectado", false)),
    }));
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const leagueId = request.nextUrl.searchParams.get("leagueId");
  const includeGlobal = request.nextUrl.searchParams.get("global") !== "false";

  const [users, rooms, predictions, matches] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, phone: true, role: true, createdAt: true },
    }),
    prisma.league.findMany({
      where: leagueId ? { id: leagueId } : undefined,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        inviteCode: true,
        competitionId: true,
        memberships: {
          select: {
            userId: true,
            role: true,
            user: { select: { id: true, name: true, phone: true, role: true, createdAt: true } },
          },
        },
      },
    }),
    prisma.prediction.findMany({
      orderBy: [{ user: { name: "asc" } }, { match: { startsAt: "asc" } }, { updatedAt: "desc" }],
      include: {
        user: { select: { id: true, name: true, phone: true, role: true, createdAt: true } },
        match: {
          select: {
            id: true,
            sourceKey: true,
            homeTeam: true,
            awayTeam: true,
            startsAt: true,
            updatedAt: true,
            homeScore: true,
            awayScore: true,
            status: true,
            isPublished: true,
            roomId: true,
            competitionId: true,
          },
        },
      },
    }),
    prisma.match.findMany({
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        sourceKey: true,
        homeTeam: true,
        awayTeam: true,
        startsAt: true,
        updatedAt: true,
        homeScore: true,
        awayScore: true,
        status: true,
        isPublished: true,
        roomId: true,
        competitionId: true,
      },
    }),
  ]);

  const roomDiagnostics = [];
  for (const room of rooms) {
    roomDiagnostics.push(await buildRoomRankingDiagnostics(room, predictions, matches));
  }

  const globalDiagnostics = includeGlobal ? buildGlobalRankingDiagnostics(users, predictions) : null;
  const globalFinishedMatchesWithoutPicks = matches
    .filter((match) => match.roomId === null && match.isPublished && isFinishedWithScore(match))
    .filter(
      (match) =>
        !predictions.some(
          (prediction) =>
            prediction.roomKey === "GLOBAL" &&
            prediction.leagueId === null &&
            prediction.matchId === match.id,
        ),
    )
    .map(matchSummary);

  return Response.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    mode: "READ_ONLY_DIAGNOSTIC",
    filters: {
      leagueId: leagueId ?? "ALL_ROOMS",
      includeGlobal,
    },
    rulesUsed: {
      officialRankingCountsOnly: "match.status === FINISHED && match.homeScore !== null && match.awayScore !== null",
      officialPointsFunction: "calculatePredictionPoints(prediction, effectiveMatch)",
      manualPoints: "ignored in official ranking diagnostics",
    },
    globalRanking: globalDiagnostics,
    rooms: roomDiagnostics,
    crossChecks: {
      duplicateMatches: buildDuplicateMatchDiagnostics(matches),
      duplicatePredictions: buildDuplicatePredictionDiagnostics(predictions),
      globalFinishedMatchesWithoutPicks,
      picksSavedInGlobalWhileUserBelongsToRooms: predictions
        .filter((prediction) => prediction.roomKey === "GLOBAL" && prediction.leagueId === null)
        .filter((prediction) => rooms.some((room) => room.memberships.some((membership) => membership.userId === prediction.userId)))
        .map((prediction) =>
          predictionSummary(prediction, prediction.match, "pick guardado en GLOBAL por usuario que pertenece a una o más salas", false),
        ),
      picksSavedInRoomThatGlobalWouldIgnore: predictions
        .filter((prediction) => prediction.roomKey !== "GLOBAL" || prediction.leagueId !== null)
        .map((prediction) =>
          predictionSummary(prediction, prediction.match, "pick guardado en sala; el ranking global lo ignora", false),
        ),
    },
  });
}
