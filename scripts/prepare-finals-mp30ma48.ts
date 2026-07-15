import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROOM_CODE = "MP30MA48";
const APPLY =
  process.argv.includes("--apply") &&
  process.env.APPLY_FINALS_MP30MA48 === "YES";

const semifinals = [
  {
    fixture: 101,
    homeTeam: "France",
    awayTeam: "Spain",
    homeScore: 0,
    awayScore: 2,
  },
  {
    fixture: 102,
    homeTeam: "England",
    awayTeam: "Argentina",
    homeScore: 1,
    awayScore: 2,
  },
] as const;

const finals = [
  {
    fixture: 103,
    fifaGameId: "53452539",
    placeholderHome: "L101",
    placeholderAway: "L102",
    homeTeam: "France",
    awayTeam: "England",
    startsAt: new Date("2026-07-18T21:00:00.000Z"),
    colombia: "2026-07-18 16:00",
    sourceKey: "openfootball-worldcup-2026-103-l101-l102",
    label: "Tercer puesto",
  },
  {
    fixture: 104,
    fifaGameId: "53452537",
    placeholderHome: "W101",
    placeholderAway: "W102",
    homeTeam: "Spain",
    awayTeam: "Argentina",
    startsAt: new Date("2026-07-19T19:00:00.000Z"),
    colombia: "2026-07-19 14:00",
    sourceKey: "openfootball-worldcup-2026-104-w101-w102",
    label: "Final",
  },
] as const;

function resultType(home: number, away: number) {
  if (home === away) return "DRAW";
  return home > away ? "HOME" : "AWAY";
}

function calculatePoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
) {
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return 5;
  }

  if (
    resultType(predictedHome, predictedAway) ===
    resultType(actualHome, actualAway)
  ) {
    return 3;
  }

  const predictedDifference = predictedHome - predictedAway;
  const actualDifference = actualHome - actualAway;

  if (predictedDifference === actualDifference) {
    return 2;
  }

  return 1;
}

async function main() {
  const room = await prisma.league.findUnique({
    where: { inviteCode: ROOM_CODE },
    select: { id: true, name: true },
  });

  if (!room) {
    throw new Error(`No se encontró la sala ${ROOM_CODE}`);
  }

  console.log(`Sala: ${room.name} (${ROOM_CODE})`);
  console.log(`League ID: ${room.id}`);
  console.log(`Modo: ${APPLY ? "APPLY" : "DRY-RUN"}`);

  let semifinalErrors = 0;
  const semifinalRows: Record<string, unknown>[] = [];

  for (const semifinal of semifinals) {
    const globalMatch = await prisma.match.findFirst({
      where: {
        roomId: null,
        homeTeam: semifinal.homeTeam,
        awayTeam: semifinal.awayTeam,
      },
      orderBy: { startsAt: "desc" },
    });

    const roomMatch = await prisma.match.findFirst({
      where: {
        roomId: room.id,
        homeTeam: semifinal.homeTeam,
        awayTeam: semifinal.awayTeam,
      },
      orderBy: { startsAt: "desc" },
      include: {
        predictions: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
    });

    if (!globalMatch || !roomMatch) {
      semifinalErrors += 1;
      semifinalRows.push({
        fixture: semifinal.fixture,
        partido: `${semifinal.homeTeam} vs ${semifinal.awayTeam}`,
        esperado: `${semifinal.homeScore}-${semifinal.awayScore}`,
        global: globalMatch ? "ENCONTRADO" : "NO ENCONTRADO",
        sala: roomMatch ? "ENCONTRADO" : "NO ENCONTRADO",
        predictions: roomMatch?.predictions.length ?? 0,
        puntosIncorrectos: "-",
      });
      continue;
    }

    const incorrectPoints = roomMatch.predictions
      .map((prediction) => {
        const expectedPoints = calculatePoints(
          prediction.homeScore,
          prediction.awayScore,
          semifinal.homeScore,
          semifinal.awayScore,
        );
        const currentPoints =
          prediction.manualPoints ?? prediction.points ?? 0;

        return {
          jugador: prediction.user.name,
          pick: `${prediction.homeScore}-${prediction.awayScore}`,
          actual: currentPoints,
          esperado: expectedPoints,
          incorrecto:
            prediction.manualPoints === null &&
            currentPoints !== expectedPoints,
        };
      })
      .filter((row) => row.incorrecto);

    const globalCorrect =
      globalMatch.status === "FINISHED" &&
      globalMatch.homeScore === semifinal.homeScore &&
      globalMatch.awayScore === semifinal.awayScore;

    const roomCorrect =
      roomMatch.status === "FINISHED" &&
      roomMatch.homeScore === semifinal.homeScore &&
      roomMatch.awayScore === semifinal.awayScore;

    if (!globalCorrect || !roomCorrect || incorrectPoints.length > 0) {
      semifinalErrors += 1;
    }

    semifinalRows.push({
      fixture: semifinal.fixture,
      partido: `${semifinal.homeTeam} vs ${semifinal.awayTeam}`,
      esperado: `${semifinal.homeScore}-${semifinal.awayScore}`,
      global: `${globalMatch.homeScore ?? "-"}-${globalMatch.awayScore ?? "-"} ${globalMatch.status}`,
      sala: `${roomMatch.homeScore ?? "-"}-${roomMatch.awayScore ?? "-"} ${roomMatch.status}`,
      predictions: roomMatch.predictions.length,
      puntosIncorrectos: incorrectPoints.length,
    });

    if (incorrectPoints.length > 0) {
      console.log(
        `\nPuntos incorrectos: ${semifinal.homeTeam} vs ${semifinal.awayTeam}`,
      );
      console.table(incorrectPoints);
    }
  }

  console.log("\nAuditoría de semifinales:");
  console.table(semifinalRows);

  const plans = [];

  for (const target of finals) {
    const globalPlaceholder = await prisma.match.findFirst({
      where: {
        roomId: null,
        OR: [
          { sourceKey: target.sourceKey },
          {
            homeTeam: target.placeholderHome,
            awayTeam: target.placeholderAway,
          },
          {
            homeTeam: target.homeTeam,
            awayTeam: target.awayTeam,
            startsAt: target.startsAt,
          },
        ],
      },
      include: {
        predictions: { select: { id: true } },
      },
    });

    const roomPlaceholder = await prisma.match.findFirst({
      where: {
        roomId: room.id,
        OR: [
          {
            homeTeam: target.placeholderHome,
            awayTeam: target.placeholderAway,
          },
          {
            homeTeam: target.homeTeam,
            awayTeam: target.awayTeam,
            startsAt: target.startsAt,
          },
        ],
      },
      include: {
        predictions: { select: { id: true } },
      },
    });

    if (!globalPlaceholder || !roomPlaceholder) {
      throw new Error(
        `No se encontraron ambos placeholders para fixture ${target.fixture}`,
      );
    }

    if (
      globalPlaceholder.predictions.length > 0 ||
      roomPlaceholder.predictions.length > 0
    ) {
      throw new Error(
        `El registro ${target.fixture} ya tiene predicciones y no se modificará.`,
      );
    }

    const globalDuplicate = await prisma.match.findFirst({
      where: {
        roomId: null,
        homeTeam: target.homeTeam,
        awayTeam: target.awayTeam,
        id: { not: globalPlaceholder.id },
      },
      select: { id: true },
    });

    const roomDuplicate = await prisma.match.findFirst({
      where: {
        roomId: room.id,
        homeTeam: target.homeTeam,
        awayTeam: target.awayTeam,
        id: { not: roomPlaceholder.id },
      },
      select: { id: true },
    });

    if (globalDuplicate || roomDuplicate) {
      throw new Error(
        `Se detectó un duplicado para ${target.homeTeam} vs ${target.awayTeam}`,
      );
    }

    const globalNeedsUpdate =
      globalPlaceholder.homeTeam !== target.homeTeam ||
      globalPlaceholder.awayTeam !== target.awayTeam ||
      globalPlaceholder.startsAt.getTime() !== target.startsAt.getTime() ||
      globalPlaceholder.status !== "SCHEDULED" ||
      globalPlaceholder.homeScore !== null ||
      globalPlaceholder.awayScore !== null ||
      globalPlaceholder.isPublished !== false;

    const roomNeedsUpdate =
      roomPlaceholder.homeTeam !== target.homeTeam ||
      roomPlaceholder.awayTeam !== target.awayTeam ||
      roomPlaceholder.startsAt.getTime() !== target.startsAt.getTime() ||
      roomPlaceholder.status !== "SCHEDULED" ||
      roomPlaceholder.homeScore !== null ||
      roomPlaceholder.awayScore !== null ||
      roomPlaceholder.isPublished !== true ||
      roomPlaceholder.sourceKey !== null;

    plans.push({
      target,
      globalPlaceholder,
      roomPlaceholder,
      globalNeedsUpdate,
      roomNeedsUpdate,
    });
  }

  console.log("\nPlan de tercer puesto y final:");
  console.table(
    plans.map((plan) => ({
      fixture: plan.target.fixture,
      fase: plan.target.label,
      fifaGameId: plan.target.fifaGameId,
      placeholder: `${plan.target.placeholderHome} vs ${plan.target.placeholderAway}`,
      partido: `${plan.target.homeTeam} vs ${plan.target.awayTeam}`,
      startsAtUTC: plan.target.startsAt.toISOString(),
      horaColombia: plan.target.colombia,
      globalAccion: plan.globalNeedsUpdate
        ? "ACTUALIZAR_GLOBAL"
        : "SIN_CAMBIO",
      salaAccion: plan.roomNeedsUpdate
        ? "ACTUALIZAR_Y_PUBLICAR"
        : "SIN_CAMBIO",
    })),
  );

  console.log(`\nErrores en semifinales: ${semifinalErrors}`);

  if (!APPLY) {
    console.log("DRY-RUN completado. No se escribió ningún dato.");
    return;
  }

  if (semifinalErrors > 0) {
    throw new Error(
      "No se publicarán los partidos porque la auditoría de semifinales tiene diferencias.",
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const plan of plans) {
      if (plan.globalNeedsUpdate) {
        await tx.match.update({
          where: { id: plan.globalPlaceholder.id },
          data: {
            homeTeam: plan.target.homeTeam,
            awayTeam: plan.target.awayTeam,
            startsAt: plan.target.startsAt,
            status: "SCHEDULED",
            homeScore: null,
            awayScore: null,
            isPublished: false,
          },
        });
      }

      if (plan.roomNeedsUpdate) {
        await tx.match.update({
          where: { id: plan.roomPlaceholder.id },
          data: {
            homeTeam: plan.target.homeTeam,
            awayTeam: plan.target.awayTeam,
            startsAt: plan.target.startsAt,
            status: "SCHEDULED",
            homeScore: null,
            awayScore: null,
            isPublished: true,
            sourceKey: null,
          },
        });
      }
    }
  });

  console.log("\nAplicación completada.");

  const verification = await prisma.match.findMany({
    where: {
      id: {
        in: plans.flatMap((plan) => [
          plan.globalPlaceholder.id,
          plan.roomPlaceholder.id,
        ]),
      },
    },
    select: {
      id: true,
      roomId: true,
      sourceKey: true,
      homeTeam: true,
      awayTeam: true,
      startsAt: true,
      status: true,
      homeScore: true,
      awayScore: true,
      isPublished: true,
      _count: { select: { predictions: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  console.log("\nAuditoría posterior:");
  console.table(
    verification.map((match) => ({
      tipo: match.roomId ? "sala" : "global",
      id: match.id,
      sourceKey: match.sourceKey,
      partido: `${match.homeTeam} vs ${match.awayTeam}`,
      startsAt: match.startsAt.toISOString(),
      status: match.status,
      marcador:
        match.homeScore === null || match.awayScore === null
          ? "-"
          : `${match.homeScore}-${match.awayScore}`,
      published: match.isPublished,
      predictions: match._count.predictions,
    })),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
