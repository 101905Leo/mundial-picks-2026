import { prisma } from "@/lib/prisma";

type LocalTeamStats = {
  team: string;
  group: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

function recordMatch(stats: Map<string, LocalTeamStats>, team: string, group: string, goalsFor: number, goalsAgainst: number) {
  const current =
    stats.get(team) ??
    {
      team,
      group,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    };

  current.played += 1;
  current.goalsFor += goalsFor;
  current.goalsAgainst += goalsAgainst;
  current.goalDifference = current.goalsFor - current.goalsAgainst;

  if (goalsFor > goalsAgainst) {
    current.won += 1;
    current.points += 3;
  } else if (goalsFor === goalsAgainst) {
    current.drawn += 1;
    current.points += 1;
  } else {
    current.lost += 1;
  }

  stats.set(team, current);
}

function sortTeams(left: LocalTeamStats, right: LocalTeamStats) {
  return (
    right.points - left.points ||
    right.goalDifference - left.goalDifference ||
    right.goalsFor - left.goalsFor ||
    left.team.localeCompare(right.team)
  );
}

function suggestedGoals(attacker?: LocalTeamStats, defender?: LocalTeamStats) {
  if (!attacker && !defender) return 1;

  const attackAverage = attacker && attacker.played > 0 ? attacker.goalsFor / attacker.played : 1.1;
  const defenseAverage = defender && defender.played > 0 ? defender.goalsAgainst / defender.played : 1.1;
  return Math.max(0, Math.min(4, Math.round((attackAverage + defenseAverage) / 2)));
}

type StatisticsOptions = {
  roomId: string;
};

async function roomStatistics(options: StatisticsOptions) {
  const [scoredMatches, upcomingMatches] = await Promise.all([
    prisma.match.findMany({
      where: { roomId: options.roomId, homeScore: { not: null }, awayScore: { not: null } },
      select: {
        homeTeam: true,
        awayTeam: true,
        group: true,
        startsAt: true,
        homeScore: true,
        awayScore: true,
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.match.findMany({
      where: {
        roomId: options.roomId,
        isPublished: true,
        homeScore: null,
        awayScore: null,
        status: "SCHEDULED",
      },
      select: {
        id: true,
        homeTeam: true,
        awayTeam: true,
        group: true,
        startsAt: true,
      },
      orderBy: { startsAt: "asc" },
      take: 8,
    }),
  ]);

  const teamStats = new Map<string, LocalTeamStats>();
  for (const match of scoredMatches) {
    const group = match.group || "Sin grupo";
    recordMatch(teamStats, match.homeTeam, group, match.homeScore ?? 0, match.awayScore ?? 0);
    recordMatch(teamStats, match.awayTeam, group, match.awayScore ?? 0, match.homeScore ?? 0);
  }

  const teams = [...teamStats.values()].sort(sortTeams);
  const groups = [...teams.reduce<Map<string, LocalTeamStats[]>>((map, team) => {
    map.set(team.group, [...(map.get(team.group) ?? []), team]);
    return map;
  }, new Map())]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([group, rows]) =>
      rows.sort(sortTeams).map((row, index) => ({
        rank: index + 1,
        team: row.team,
        teamLogo: "",
        group,
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        points: row.points,
      })),
    );

  const predictionSuggestions = upcomingMatches.map((match) => {
    const homeStats = teamStats.get(match.homeTeam);
    const awayStats = teamStats.get(match.awayTeam);
    const homeScore = suggestedGoals(homeStats, awayStats);
    const awayScore = suggestedGoals(awayStats, homeStats);
    const dataPoints = (homeStats?.played ?? 0) + (awayStats?.played ?? 0);

    return {
      matchId: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      startsAt: match.startsAt,
      suggestedHomeScore: homeScore,
      suggestedAwayScore: awayScore,
      confidence: dataPoints >= 4 ? "Media" : dataPoints > 0 ? "Baja" : "Inicial",
      reason:
        dataPoints > 0
          ? "Basado en goles a favor, goles recibidos y resultados cargados en Mundial Picks."
          : "Sin historial suficiente; sugerencia inicial conservadora.",
    };
  });

  return {
    localTeamStats: teams,
    localGroups: groups,
    predictionSuggestions,
    localMatchesCount: scoredMatches.length,
  };
}

export async function getWorldCupStatistics(options: StatisticsOptions) {
  const local = await roomStatistics(options);

  return {
    topScorers: [],
    groups: local.localGroups,
    localTeamStats: local.localTeamStats,
    predictionSuggestions: local.predictionSuggestions,
    localMatchesCount: local.localMatchesCount,
    updatedAt: new Date().toISOString(),
    configured: true,
    source: "room-local",
  };
}
