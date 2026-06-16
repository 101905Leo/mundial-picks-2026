import { PrismaClient } from "@prisma/client";
import { sameMatchByTeamsAndKickoff } from "../src/lib/match-equivalence";
import { roomMatchScopeWhere } from "../src/lib/room-match-scope";

const prisma = new PrismaClient();
const roomName = "Familia Avella";

async function main() {
  const room = await prisma.league.findFirst({
    where: { name: { equals: roomName, mode: "insensitive" } },
    include: {
      memberships: {
        include: {
          user: { select: { id: true, name: true, phone: true, role: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!room) {
    throw new Error(`No encontre la sala "${roomName}".`);
  }

  const members = room.memberships.filter((membership) => membership.user.role !== "ADMIN");
  const memberIds = members.map((membership) => membership.userId);

  const roomMatches = await prisma.match.findMany({
    where: roomMatchScopeWhere(room),
    select: {
      id: true,
      roomId: true,
      competitionId: true,
      homeTeam: true,
      awayTeam: true,
      startsAt: true,
      status: true,
      homeScore: true,
      awayScore: true,
    },
    orderBy: { startsAt: "asc" },
  });

  const roomOwnedMatches = roomMatches.filter((match) => match.roomId === room.id);

  const globalPredictions = await prisma.prediction.findMany({
    where: {
      userId: { in: memberIds },
      leagueId: null,
      roomKey: "GLOBAL",
    },
    include: {
      user: { select: { id: true, name: true, phone: true } },
      match: {
        select: {
          id: true,
          roomId: true,
          competitionId: true,
          homeTeam: true,
          awayTeam: true,
          startsAt: true,
          status: true,
          homeScore: true,
          awayScore: true,
        },
      },
    },
    orderBy: [{ user: { name: "asc" } }, { match: { startsAt: "asc" } }],
  });

  const repairCandidates = globalPredictions
    .map((prediction) => {
      const belongsToRoomScope = roomMatches.some((match) => sameMatchByTeamsAndKickoff(match, prediction.match));
      if (!belongsToRoomScope) return null;

      const roomOwnedMatch = roomOwnedMatches.find((match) => sameMatchByTeamsAndKickoff(match, prediction.match));

      return {
        predictionId: prediction.id,
        userId: prediction.userId,
        userName: prediction.user.name,
        currentMatchId: prediction.matchId,
        targetMatchId: roomOwnedMatch?.id ?? prediction.matchId,
        hasRoomOwnedMatch: Boolean(roomOwnedMatch),
        currentLeagueId: prediction.leagueId,
        currentRoomKey: prediction.roomKey,
        targetLeagueId: room.id,
        targetRoomKey: room.id,
        match: `${prediction.match.homeTeam} vs ${prediction.match.awayTeam}`,
        startsAt: prediction.match.startsAt.toISOString(),
        pick: `${prediction.homeScore}-${prediction.awayScore}`,
        matchStatus: prediction.match.status,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

  const byUser = members.map((membership) => {
    const total = repairCandidates.filter((candidate) => candidate.userId === membership.userId).length;
    return {
      userId: membership.userId,
      name: membership.user.name,
      globalPicksThatLookLikeRoomPicks: total,
    };
  });

  console.log(`Sala: ${room.name}`);
  console.log(`roomId correcto: ${room.id}`);
  console.log(`Miembros revisados: ${members.length}`);
  console.log(`Picks GLOBAL de miembros: ${globalPredictions.length}`);
  console.log(`Picks GLOBAL que parecen pertenecer a esta sala: ${repairCandidates.length}`);
  console.log(`Con partido propio de sala encontrado: ${repairCandidates.filter((item) => item.hasRoomOwnedMatch).length}`);
  console.log(`Sin partido propio de sala encontrado: ${repairCandidates.filter((item) => !item.hasRoomOwnedMatch).length}`);
  console.log("\nResumen por usuario:");
  console.table(byUser);
  console.log("\nCandidatos de reparacion SOLO LECTURA:");
  console.table(repairCandidates);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
