import { prisma } from "@/lib/prisma";

const defaultScheduleUrl =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";
const worldCupCompetitionSlug = "mundial-2026";
const openFootballWorldCupSourcePrefix = "openfootball-worldcup-2026";

type OpenFootballMatch = {
  round?: string;
  date: string;
  time?: string;
  team1: string;
  team2: string;
  group?: string;
  ground?: string;
};

type OpenFootballSchedule = {
  name: string;
  matches: OpenFootballMatch[];
};

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function startsAtFromOpenFootball(match: OpenFootballMatch) {
  const time = match.time || "12:00 UTC";
  const parsed = time.match(/^(\d{1,2}):(\d{2})(?:\s+UTC([+-]\d{1,2})?)?$/);

  if (!parsed) {
    return new Date(`${match.date}T12:00:00.000Z`);
  }

  const hour = parsed[1].padStart(2, "0");
  const minute = parsed[2];
  const offsetHour = parsed[3] ? Number(parsed[3]) : null;
  const offset =
    offsetHour === null
      ? "Z"
      : `${offsetHour >= 0 ? "+" : "-"}${String(Math.abs(offsetHour)).padStart(2, "0")}:00`;

  return new Date(`${match.date}T${hour}:${minute}:00${offset}`);
}

export async function importWorldCupCalendar() {
  const scheduleUrl = process.env.WORLD_CUP_2026_SCHEDULE_URL || defaultScheduleUrl;
  const response = await fetch(scheduleUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`No se pudo descargar el calendario: ${response.status}`);
  }

  const schedule = (await response.json()) as OpenFootballSchedule;

  if (!Array.isArray(schedule.matches)) {
    throw new Error("El calendario no tiene una lista de partidos valida");
  }

  const competition = await prisma.competition.upsert({
    where: { slug: worldCupCompetitionSlug },
    update: { isActive: true },
    create: {
      slug: worldCupCompetitionSlug,
      name: "Mundial 2026",
      country: "Internacional",
      season: "2026",
      isActive: true,
    },
  });

  const backfilled = await prisma.match.updateMany({
    where: {
      sourceKey: { startsWith: openFootballWorldCupSourcePrefix },
      roomId: null,
      competitionId: null,
    },
    data: { competitionId: competition.id },
  });

  await prisma.match.deleteMany({
    where: {
      id: {
        in: ["mexico-south-africa", "canada-japan", "united-states-ghana"],
      },
      predictions: { none: {} },
    },
  });

  let created = 0;
  let updated = 0;

  for (const [index, match] of schedule.matches.entries()) {
    const sourceKey = `${openFootballWorldCupSourcePrefix}-${String(index + 1).padStart(3, "0")}-${slug(
      `${match.team1}-${match.team2}`,
    )}`;

    const existing = await prisma.match.findUnique({ where: { sourceKey } });
    const data = {
      homeTeam: match.team1,
      awayTeam: match.team2,
      group: match.group || match.round || null,
      venue: match.ground || null,
      startsAt: startsAtFromOpenFootball(match),
      competitionId: competition.id,
    };

    await prisma.match.upsert({
      where: { sourceKey },
      create: {
        sourceKey,
        ...data,
      },
      update: data,
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  return {
    source: schedule.name,
    total: schedule.matches.length,
    created,
    updated,
    backfilled: backfilled.count,
    competition: {
      id: competition.id,
      slug: competition.slug,
      name: competition.name,
      season: competition.season,
    },
  };
}
