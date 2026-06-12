type ApiResponse<T> = {
  errors?: Record<string, string> | string[];
  response?: T[];
};

type TopScorerItem = {
  player?: { id?: number; name?: string; photo?: string };
  statistics?: Array<{
    team?: { name?: string; logo?: string };
    games?: { appearances?: number | null };
    goals?: { total?: number | null; assists?: number | null };
  }>;
};

type StandingRow = {
  rank?: number;
  team?: { id?: number; name?: string; logo?: string };
  points?: number;
  goalsDiff?: number;
  group?: string;
  all?: {
    played?: number;
    win?: number;
    draw?: number;
    lose?: number;
    goals?: { for?: number; against?: number };
  };
};

function apiConfig() {
  return {
    key: process.env.API_FOOTBALL_KEY,
    league: process.env.API_FOOTBALL_LEAGUE_ID || "1",
    season: process.env.API_FOOTBALL_SEASON || "2026",
  };
}

async function apiFootball<T>(path: string) {
  const config = apiConfig();
  if (!config.key) return [] as T[];

  const url = new URL(`https://v3.football.api-sports.io/${path}`);
  url.searchParams.set("league", config.league);
  url.searchParams.set("season", config.season);

  const response = await fetch(url, {
    next: { revalidate: 900 },
    headers: { "x-apisports-key": config.key },
  });

  if (!response.ok) throw new Error(`API-Football respondio ${response.status}`);

  const data = (await response.json()) as ApiResponse<T>;
  if (!Array.isArray(data.response)) return [];
  return data.response;
}

export async function getWorldCupStatistics() {
  const [topScorersResult, standingsResult] = await Promise.allSettled([
    apiFootball<TopScorerItem>("players/topscorers"),
    apiFootball<{ league?: { standings?: StandingRow[][] } }>("standings"),
  ]);

  const topScorers =
    topScorersResult.status === "fulfilled"
      ? topScorersResult.value.slice(0, 12).map((item) => {
          const stats = item.statistics?.[0];
          return {
            id: item.player?.id ?? 0,
            name: item.player?.name ?? "Jugador",
            photo: item.player?.photo ?? "",
            team: stats?.team?.name ?? "",
            teamLogo: stats?.team?.logo ?? "",
            goals: stats?.goals?.total ?? 0,
            assists: stats?.goals?.assists ?? 0,
            appearances: stats?.games?.appearances ?? 0,
          };
        })
      : [];

  const groups =
    standingsResult.status === "fulfilled"
      ? (standingsResult.value[0]?.league?.standings ?? []).map((rows) =>
          rows.map((row) => ({
            rank: row.rank ?? 0,
            team: row.team?.name ?? "Seleccion",
            teamLogo: row.team?.logo ?? "",
            group: row.group ?? "",
            played: row.all?.played ?? 0,
            won: row.all?.win ?? 0,
            drawn: row.all?.draw ?? 0,
            lost: row.all?.lose ?? 0,
            goalsFor: row.all?.goals?.for ?? 0,
            goalsAgainst: row.all?.goals?.against ?? 0,
            goalDifference: row.goalsDiff ?? 0,
            points: row.points ?? 0,
          })),
        )
      : [];

  return {
    topScorers,
    groups,
    updatedAt: new Date().toISOString(),
    configured: Boolean(apiConfig().key),
  };
}
