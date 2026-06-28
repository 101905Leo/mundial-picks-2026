import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const roomInviteCode = "MP30MA48";
const roomName = "16avos Mundial 2026";
const applyToken = "YES_UPDATE_MP30MA48";

const proposedMatches = [
  {
    id: "cmqso2dnt004fl204vbopnx62",
    current: ["2A", "2B"],
    proposed: ["South Africa", "Canada"],
    startsAt: "2026-06-28T19:00:00.000Z",
  },
  {
    id: "cmqso2dnv004hl20400ldtkdu",
    current: ["1C", "2F"],
    proposed: ["Brazil", "Japan"],
    startsAt: "2026-06-29T17:00:00.000Z",
  },
  {
    id: "cmqso2dny004jl2043kpeyuvi",
    current: ["1E", "3A/B/C/D/F"],
    proposed: ["Germany", "Paraguay"],
    startsAt: "2026-06-29T20:30:00.000Z",
  },
  {
    id: "cmqso2do0004ll204mywzzcqm",
    current: ["1F", "2C"],
    proposed: ["Netherlands", "Morocco"],
    startsAt: "2026-06-30T01:00:00.000Z",
  },
  {
    id: "cmqso2do2004nl204ueciu7jm",
    current: ["2E", "2I"],
    proposed: ["Ivory Coast", "Norway"],
    startsAt: "2026-06-30T17:00:00.000Z",
  },
  {
    id: "cmqso2do4004pl204ytiwsrd1",
    current: ["1I", "3C/D/F/G/H"],
    proposed: ["France", "Sweden"],
    startsAt: "2026-06-30T21:00:00.000Z",
  },
  {
    id: "cmqso2do6004rl204akavw08z",
    current: ["1A", "3C/E/F/H/I"],
    proposed: ["Mexico", "Ecuador"],
    startsAt: "2026-07-01T01:00:00.000Z",
  },
  {
    id: "cmqso2do8004tl204sbw4frih",
    current: ["1L", "3E/H/I/J/K"],
    proposed: ["England", "Congo DR"],
    startsAt: "2026-07-01T16:00:00.000Z",
  },
  {
    id: "cmqso2doa004vl20456fj2lio",
    current: ["1G", "3A/E/H/I/J"],
    proposed: ["Belgium", "Senegal"],
    startsAt: "2026-07-01T20:00:00.000Z",
  },
  {
    id: "cmqso2dod004xl204rptmphzy",
    current: ["1D", "3B/E/F/I/J"],
    proposed: ["USA", "Bosnia and Herzegovina"],
    startsAt: "2026-07-02T00:00:00.000Z",
  },
  {
    id: "cmqso2dof004zl204e5ia9esq",
    current: ["1H", "2J"],
    proposed: ["Spain", "Austria"],
    startsAt: "2026-07-02T19:00:00.000Z",
  },
  {
    id: "cmqso2doh0051l204iabcnnmx",
    current: ["2K", "2L"],
    proposed: ["Portugal", "Croatia"],
    startsAt: "2026-07-02T23:00:00.000Z",
  },
  {
    id: "cmqso2doj0053l204n3w5x34o",
    current: ["1B", "3E/F/G/I/J"],
    proposed: ["Switzerland", "Algeria"],
    startsAt: "2026-07-03T03:00:00.000Z",
  },
  {
    id: "cmqso2doq0055l204ofu0nt0x",
    current: ["2D", "2G"],
    proposed: ["Australia", "Egypt"],
    startsAt: "2026-07-03T18:00:00.000Z",
  },
  {
    id: "cmqso2dos0057l204lumrifyr",
    current: ["1J", "2H"],
    proposed: ["Argentina", "Cabo Verde"],
    startsAt: "2026-07-03T22:00:00.000Z",
  },
  {
    id: "cmqso2dou0059l204dtm3nga5",
    current: ["1K", "3D/E/I/J/L"],
    proposed: ["Colombia", "Ghana"],
    startsAt: "2026-07-04T01:30:00.000Z",
  },
] as const;

async function main() {
  const room = await prisma.league.findUnique({
    where: { inviteCode: roomInviteCode },
    select: { id: true, name: true, competitionId: true },
  });

  if (!room || room.name !== roomName) {
    throw new Error(`No se encontro exactamente la sala ${roomName} (${roomInviteCode}).`);
  }

  const ids = proposedMatches.map((match) => match.id);
  if (new Set(ids).size !== 16) {
    throw new Error("La propuesta debe contener exactamente 16 IDs unicos.");
  }

  const currentMatches = await prisma.match.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      homeTeam: true,
      awayTeam: true,
      group: true,
      startsAt: true,
      status: true,
      isPublished: true,
      roomId: true,
      competitionId: true,
      homeScore: true,
      awayScore: true,
      _count: { select: { predictions: true } },
    },
  });
  const currentById = new Map(currentMatches.map((match) => [match.id, match]));
  const issues: string[] = [];
  let pendingUpdates = 0;
  let alreadyUpdated = 0;

  for (const proposal of proposedMatches) {
    const current = currentById.get(proposal.id);
    if (!current) {
      issues.push(`${proposal.id}: partido no encontrado.`);
      continue;
    }
    if (current.roomId !== room.id) issues.push(`${proposal.id}: pertenece a otra sala.`);
    if (current.competitionId !== room.competitionId) issues.push(`${proposal.id}: competencia inconsistente.`);
    if (current.group !== "Round of 32") issues.push(`${proposal.id}: no es Round of 32.`);
    if (current.status !== "SCHEDULED") issues.push(`${proposal.id}: ya no esta SCHEDULED.`);
    if (current.isPublished) issues.push(`${proposal.id}: ya esta publicado.`);
    if (current.homeScore !== null || current.awayScore !== null) issues.push(`${proposal.id}: ya tiene marcador.`);
    if (current._count.predictions !== 0) issues.push(`${proposal.id}: tiene picks asociados.`);
    if (current.startsAt.toISOString() !== proposal.startsAt) issues.push(`${proposal.id}: cambio su startsAt.`);
    const hasExpectedPlaceholder =
      current.homeTeam === proposal.current[0] && current.awayTeam === proposal.current[1];
    const hasProposedTeams =
      current.homeTeam === proposal.proposed[0] && current.awayTeam === proposal.proposed[1];
    if (hasExpectedPlaceholder) pendingUpdates += 1;
    if (hasProposedTeams) alreadyUpdated += 1;
    if (!hasExpectedPlaceholder && !hasProposedTeams) {
      issues.push(`${proposal.id}: los equipos actuales ya no coinciden con los placeholders esperados.`);
    }
  }

  if (pendingUpdates > 0 && alreadyUpdated > 0) {
    issues.push("Se detecto una actualizacion parcial; no se aplicaran cambios adicionales.");
  }

  console.table(
    proposedMatches.map((proposal) => ({
      id: proposal.id,
      actual: (() => {
        const current = currentById.get(proposal.id);
        return current ? `${current.homeTeam} vs ${current.awayTeam}` : "No encontrado";
      })(),
      propuesto: proposal.proposed.join(" vs "),
      startsAt: proposal.startsAt,
    })),
  );

  if (issues.length) {
    throw new Error(`Validacion cancelada:\n- ${issues.join("\n- ")}`);
  }

  if (alreadyUpdated === proposedMatches.length) {
    console.log("Verificacion aprobada: los 16 partidos ya tienen los equipos propuestos y siguen ocultos.");
    return;
  }

  if (process.env.APPLY_ROUND_OF_32_UPDATE !== applyToken) {
    console.log(`DRY RUN aprobado. Para aplicar: APPLY_ROUND_OF_32_UPDATE=${applyToken}`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const proposal of proposedMatches) {
      const updated = await tx.match.updateMany({
        where: {
          id: proposal.id,
          roomId: room.id,
          competitionId: room.competitionId,
          group: "Round of 32",
          status: "SCHEDULED",
          isPublished: false,
          homeScore: null,
          awayScore: null,
          startsAt: new Date(proposal.startsAt),
          homeTeam: proposal.current[0],
          awayTeam: proposal.current[1],
          predictions: { none: {} },
        },
        data: {
          homeTeam: proposal.proposed[0],
          awayTeam: proposal.proposed[1],
          isPublished: false,
        },
      });

      if (updated.count !== 1) {
        throw new Error(`${proposal.id}: cambio concurrente detectado; se revierte toda la transaccion.`);
      }
    }
  });

  console.log("Actualizacion completada: 16 partidos, IDs conservados y todos ocultos.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
