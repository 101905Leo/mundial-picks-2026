import { PrismaClient } from "@prisma/client";
import { sameMatchByTeamsAndKickoff } from "../src/lib/match-equivalence";

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
      },
    },
  });

  if (!room) {
    throw new Error(`No encontre la sala "${roomName}".`);
  }

  const members = room.memberships.filter((membership) => membership.user.role !== "ADMIN");
  const memberIds = members.map((membership) => membership.userId);

  const [roomMatches, globalPredictions, existingRoomPredictions] = await Promise.all([
    prisma.match.findMany({
      where: { roomId: room.id },
      select: {
        id: true,
        competitionId: true,
        roomId: true,
        homeTeam: true,
        awayTeam: true,
        startsAt: true,
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.prediction.findMany({
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
            competitionId: true,
            roomId: true,
            homeTeam: true,
            awayTeam: true,
            startsAt: true,
          },
        },
      },
      orderBy: [{ user: { name: "asc" } }, { match: { startsAt: "asc" } }],
    }),
    prisma.prediction.findMany({
      where: {
        userId: { in: memberIds },
        OR: [{ leagueId: room.id }, { roomKey: room.id }],
      },
      select: {
        id: true,
        userId: true,
        matchId: true,
        roomKey: true,
        leagueId: true,
      },
    }),
  ]);

  const rows = globalPredictions.map((prediction) => {
    const equivalentRoomMatches = roomMatches.filter((match) => sameMatchByTeamsAndKickoff(match, prediction.match));
    const proposedRoomMatch = equivalentRoomMatches[0] ?? null;
    const duplicate = proposedRoomMatch
      ? existingRoomPredictions.find(
          (existing) =>
            existing.userId === prediction.userId &&
            existing.matchId === proposedRoomMatch.id &&
            existing.roomKey === room.id,
        )
      : null;
    const hasMultipleMatches = equivalentRoomMatches.length > 1;
    const status = !proposedRoomMatch
      ? "IGNORADO_SIN_MATCH_EQUIVALENTE"
      : hasMultipleMatches
        ? "CONFLICTO_MULTIPLES_MATCHES"
        : duplicate
          ? "CONFLICTO_PICK_EXISTENTE"
          : "SEGURO";

    return {
      status,
      predictionId: prediction.id,
      userId: prediction.userId,
      usuario: prediction.user.name,
      matchGlobalActual: `${prediction.match.homeTeam} vs ${prediction.match.awayTeam} (${prediction.match.startsAt.toISOString()})`,
      matchGlobalIdActual: prediction.matchId,
      matchSalaEquivalente: proposedRoomMatch
        ? `${proposedRoomMatch.homeTeam} vs ${proposedRoomMatch.awayTeam} (${proposedRoomMatch.startsAt.toISOString()})`
        : "",
      matchSalaIdEquivalente: proposedRoomMatch?.id ?? "",
      leagueIdActual: prediction.leagueId,
      roomKeyActual: prediction.roomKey,
      leagueIdPropuesto: proposedRoomMatch ? room.id : "",
      roomKeyPropuesto: proposedRoomMatch ? room.id : "",
      matchIdPropuesto: proposedRoomMatch?.id ?? "",
      conflicto: duplicate?.id ?? (hasMultipleMatches ? "multiples matches equivalentes" : ""),
    };
  });

  const totalCandidatos = rows.filter((row) => row.matchSalaIdEquivalente).length;
  const totalSeguros = rows.filter((row) => row.status === "SEGURO").length;
  const totalConConflicto = rows.filter((row) => row.status.startsWith("CONFLICTO")).length;
  const totalIgnorados = rows.filter((row) => row.status.startsWith("IGNORADO")).length;

  console.log(`Sala: ${room.name}`);
  console.log(`roomId / leagueId propuesto: ${room.id}`);
  console.log(`Miembros revisados: ${members.length}`);
  console.log(`Picks GLOBAL revisados: ${globalPredictions.length}`);
  console.log("");
  console.log("Resumen dry-run:");
  console.table([
    {
      totalCandidatos,
      totalSegurosParaReparar: totalSeguros,
      totalConConflicto,
      totalIgnorados,
    },
  ]);
  console.log("");
  console.log("Detalle de picks candidatos, conflictos e ignorados:");
  console.table(rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
