import type { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sameMatchByTeamsAndKickoff } from "@/lib/match-equivalence";

type MatchForSync = {
  id: string;
  roomId: string | null;
  competitionId: string | null;
  sourceKey: string | null;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
};

type SyncIssue = {
  globalMatchId: string;
  roomMatchId?: string;
  roomId?: string | null;
  match: string;
  startsAt: string;
  reason: string;
  globalScore?: string;
  roomScore?: string;
  globalStatus?: MatchStatus;
  roomStatus?: MatchStatus;
};

function scoreLabel(match: Pick<MatchForSync, "homeScore" | "awayScore">) {
  if (match.homeScore === null || match.awayScore === null) return "sin marcador";
  return `${match.homeScore}-${match.awayScore}`;
}

function scoreIsComplete(match: Pick<MatchForSync, "homeScore" | "awayScore">) {
  return match.homeScore !== null && match.awayScore !== null;
}

function matchLabel(match: Pick<MatchForSync, "homeTeam" | "awayTeam">) {
  return `${match.homeTeam} vs ${match.awayTeam}`;
}

function findGlobalEquivalent(roomMatch: MatchForSync, globalMatches: MatchForSync[]) {
  const candidates = globalMatches.filter((globalMatch) => sameMatchByTeamsAndKickoff(globalMatch, roomMatch));

  if (candidates.length <= 1) {
    return { match: candidates[0] ?? null, hasConflict: false };
  }

  const sameCompetition = candidates.filter(
    (globalMatch) =>
      Boolean(globalMatch.competitionId && roomMatch.competitionId) &&
      globalMatch.competitionId === roomMatch.competitionId,
  );
  const preferred = sameCompetition.length === 1 ? sameCompetition[0] : null;

  return {
    match: preferred,
    hasConflict: !preferred,
  };
}

export async function syncRoomMatchesFromGlobalResults(options: { roomId?: string } = {}) {
  const [globalMatches, roomMatches] = await Promise.all([
    prisma.match.findMany({
      where: { roomId: null },
      select: {
        id: true,
        roomId: true,
        competitionId: true,
        sourceKey: true,
        homeTeam: true,
        awayTeam: true,
        startsAt: true,
        homeScore: true,
        awayScore: true,
        status: true,
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.match.findMany({
      where: { roomId: options.roomId ? options.roomId : { not: null } },
      select: {
        id: true,
        roomId: true,
        competitionId: true,
        sourceKey: true,
        homeTeam: true,
        awayTeam: true,
        startsAt: true,
        homeScore: true,
        awayScore: true,
        status: true,
      },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  let matched = 0;
  let updated = 0;
  let alreadySynced = 0;
  let finishedSynced = 0;
  let liveSynced = 0;
  let scheduledSynced = 0;
  const missingGlobalScore: SyncIssue[] = [];
  const conflicts: SyncIssue[] = [];
  const errors: SyncIssue[] = [];

  for (const roomMatch of roomMatches) {
    const { match: globalMatch, hasConflict } = findGlobalEquivalent(roomMatch, globalMatches);

    if (hasConflict) {
      conflicts.push({
        globalMatchId: "",
        roomMatchId: roomMatch.id,
        roomId: roomMatch.roomId,
        match: matchLabel(roomMatch),
        startsAt: roomMatch.startsAt.toISOString(),
        reason: "Mas de un partido global equivalente",
        roomScore: scoreLabel(roomMatch),
        roomStatus: roomMatch.status,
      });
      continue;
    }

    if (!globalMatch) continue;
    matched += 1;

    const globalHasScore = scoreIsComplete(globalMatch);
    if (!globalHasScore) {
      missingGlobalScore.push({
        globalMatchId: globalMatch.id,
        roomMatchId: roomMatch.id,
        roomId: roomMatch.roomId,
        match: matchLabel(globalMatch),
        startsAt: globalMatch.startsAt.toISOString(),
        reason: "El partido global equivalente no tiene marcador completo",
        globalScore: scoreLabel(globalMatch),
        roomScore: scoreLabel(roomMatch),
        globalStatus: globalMatch.status,
        roomStatus: roomMatch.status,
      });
    }

    if (
      globalHasScore &&
      scoreIsComplete(roomMatch) &&
      (roomMatch.homeScore !== globalMatch.homeScore || roomMatch.awayScore !== globalMatch.awayScore)
    ) {
      conflicts.push({
        globalMatchId: globalMatch.id,
        roomMatchId: roomMatch.id,
        roomId: roomMatch.roomId,
        match: matchLabel(globalMatch),
        startsAt: globalMatch.startsAt.toISOString(),
        reason: "La sala tenia marcador diferente al global; se sincroniza con el global",
        globalScore: scoreLabel(globalMatch),
        roomScore: scoreLabel(roomMatch),
        globalStatus: globalMatch.status,
        roomStatus: roomMatch.status,
      });
    }

    const scoreNeedsUpdate =
      globalHasScore &&
      (roomMatch.homeScore !== globalMatch.homeScore || roomMatch.awayScore !== globalMatch.awayScore);
    const statusNeedsUpdate = roomMatch.status !== globalMatch.status;
    const needsUpdate = scoreNeedsUpdate || statusNeedsUpdate;

    if (!needsUpdate) {
      alreadySynced += 1;
      continue;
    }

    try {
      await prisma.match.update({
        where: { id: roomMatch.id },
        data: {
          status: globalMatch.status,
          ...(globalHasScore
            ? {
                homeScore: globalMatch.homeScore,
                awayScore: globalMatch.awayScore,
              }
            : {}),
        },
      });
      updated += 1;
      if (globalMatch.status === "FINISHED") finishedSynced += 1;
      if (globalMatch.status === "LIVE") liveSynced += 1;
      if (globalMatch.status === "SCHEDULED") scheduledSynced += 1;
    } catch (error) {
      errors.push({
        globalMatchId: globalMatch.id,
        roomMatchId: roomMatch.id,
        roomId: roomMatch.roomId,
        match: matchLabel(globalMatch),
        startsAt: globalMatch.startsAt.toISOString(),
        reason: error instanceof Error ? error.message : "Error desconocido al sincronizar",
        globalScore: scoreLabel(globalMatch),
        roomScore: scoreLabel(roomMatch),
        globalStatus: globalMatch.status,
        roomStatus: roomMatch.status,
      });
    }
  }

  return {
    checked: roomMatches.length,
    matched,
    updated,
    alreadySynced,
    finishedSynced,
    liveSynced,
    scheduledSynced,
    missingGlobalScore,
    conflicts,
    errors,
  };
}

export async function syncRoomResultsFromGlobal(options: { roomId?: string } = {}) {
  return syncRoomMatchesFromGlobalResults(options);
}
