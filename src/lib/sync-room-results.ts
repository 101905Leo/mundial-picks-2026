import { prisma } from "@/lib/prisma";

type ScoredMatch = {
  id: string;
  roomId: string | null;
  competitionId: string | null;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date;
  homeScore: number | null;
  awayScore: number | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
};

function normalizeTeam(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function closeKickoff(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) <= 18 * 60 * 60 * 1000;
}

function sameMatch(left: ScoredMatch, right: ScoredMatch) {
  if (!left.competitionId || left.competitionId !== right.competitionId) return false;
  if (!closeKickoff(left.startsAt, right.startsAt)) return false;
  return normalizeTeam(left.homeTeam) === normalizeTeam(right.homeTeam) && normalizeTeam(left.awayTeam) === normalizeTeam(right.awayTeam);
}

export async function syncRoomResultsFromGlobal() {
  const globalMatches = await prisma.match.findMany({
    where: {
      roomId: null,
      status: { in: ["LIVE", "FINISHED"] },
      homeScore: { not: null },
      awayScore: { not: null },
    },
    select: {
      id: true,
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

  if (!globalMatches.length) return 0;
  const competitionIds = [...new Set(globalMatches.map((match) => match.competitionId).filter(Boolean) as string[])];
  if (!competitionIds.length) return 0;

  const roomMatches = await prisma.match.findMany({
    where: {
      roomId: { not: null },
      competitionId: { in: competitionIds },
    },
    select: {
      id: true,
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

  let synced = 0;
  for (const roomMatch of roomMatches) {
    const globalMatch = globalMatches.find((match) => sameMatch(match, roomMatch));
    if (!globalMatch) continue;

    if (
      roomMatch.homeScore === globalMatch.homeScore &&
      roomMatch.awayScore === globalMatch.awayScore &&
      roomMatch.status === globalMatch.status
    ) {
      continue;
    }

    await prisma.match.update({
      where: { id: roomMatch.id },
      data: {
        homeScore: globalMatch.homeScore,
        awayScore: globalMatch.awayScore,
        status: globalMatch.status,
      },
    });
    synced += 1;
  }

  return synced;
}
