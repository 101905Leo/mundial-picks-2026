import { prisma } from "@/lib/prisma";

type ScoredMatch = {
  id: string;
  roomId: string | null;
  competitionId: string | null;
  sourceKey?: string | null;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date;
  homeScore: number | null;
  awayScore: number | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
};

function normalizeTeam(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  const aliases: Record<string, string> = {
    usa: "unitedstates",
    unitedstatesofamerica: "unitedstates",
    usmnt: "unitedstates",
    korearepublic: "southkorea",
    republicofkorea: "southkorea",
    iriran: "iran",
    coteivoire: "ivorycoast",
    ctedivoire: "ivorycoast",
  };

  return aliases[normalized] ?? normalized;
}

function closeKickoff(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) <= 18 * 60 * 60 * 1000;
}

function sameMatch(left: ScoredMatch, right: ScoredMatch) {
  const bothHaveCompetition = Boolean(left.competitionId && right.competitionId);
  if (bothHaveCompetition && left.competitionId !== right.competitionId) return false;
  if (!closeKickoff(left.startsAt, right.startsAt)) return false;
  return normalizeTeam(left.homeTeam) === normalizeTeam(right.homeTeam) && normalizeTeam(left.awayTeam) === normalizeTeam(right.awayTeam);
}

const statusPriority: Record<ScoredMatch["status"], number> = {
  SCHEDULED: 0,
  LIVE: 1,
  FINISHED: 2,
};

function sourcePriority(match: ScoredMatch) {
  return statusPriority[match.status] * 100 + (match.roomId === null ? 10 : 0) + (match.sourceKey ? 1 : 0);
}

export async function syncRoomResultsFromGlobal(options: { roomId?: string } = {}) {
  const emptyStats = { matched: 0, updated: 0, alreadySynced: 0 };
  const sourceMatches = await prisma.match.findMany({
    where: {
      roomId: options.roomId ? { not: options.roomId } : null,
      homeScore: { not: null },
      awayScore: { not: null },
    },
    select: {
      id: true,
      sourceKey: true,
      roomId: true,
      competitionId: true,
      homeTeam: true,
      awayTeam: true,
      startsAt: true,
      homeScore: true,
      awayScore: true,
      status: true,
    },
  });

  if (!sourceMatches.length) return emptyStats;
  const competitionIds = [...new Set(sourceMatches.map((match) => match.competitionId).filter(Boolean) as string[])];

  const roomMatches = await prisma.match.findMany({
    where: {
      roomId: options.roomId ? options.roomId : { not: null },
      OR: competitionIds.length ? [{ competitionId: { in: competitionIds } }, { competitionId: null }] : undefined,
    },
    select: {
      id: true,
      sourceKey: true,
      roomId: true,
      competitionId: true,
      homeTeam: true,
      awayTeam: true,
      startsAt: true,
      homeScore: true,
      awayScore: true,
      status: true,
    },
  });

  let matched = 0;
  let updated = 0;
  let alreadySynced = 0;

  for (const roomMatch of roomMatches) {
    const sourceMatch = sourceMatches
      .filter((match) => sameMatch(match, roomMatch))
      .sort((left, right) => sourcePriority(right) - sourcePriority(left))[0];
    if (!sourceMatch) continue;
    matched += 1;

    if (
      roomMatch.homeScore === sourceMatch.homeScore &&
      roomMatch.awayScore === sourceMatch.awayScore &&
      roomMatch.status === sourceMatch.status
    ) {
      alreadySynced += 1;
      continue;
    }

    await prisma.match.update({
      where: { id: roomMatch.id },
      data: {
        homeScore: sourceMatch.homeScore,
        awayScore: sourceMatch.awayScore,
        status: sourceMatch.status,
      },
    });
    updated += 1;
  }

  return { matched, updated, alreadySynced };
}
