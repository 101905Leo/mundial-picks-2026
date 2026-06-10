export type OfficialRankingEntry = {
  rank: number;
  team: string;
  points: string;
};

export const officialRanking: OfficialRankingEntry[] = [
  { rank: 1, team: "France", points: "1877.32" },
  { rank: 2, team: "Spain", points: "1876.40" },
  { rank: 3, team: "Argentina", points: "1874.81" },
  { rank: 4, team: "England", points: "1825.97" },
  { rank: 5, team: "Portugal", points: "1763.83" },
  { rank: 6, team: "Brazil", points: "1761.16" },
  { rank: 7, team: "Netherlands", points: "1757.87" },
  { rank: 8, team: "Morocco", points: "1755.87" },
  { rank: 9, team: "Belgium", points: "1734.71" },
  { rank: 10, team: "Germany", points: "1730.37" },
];

export const officialRankingUrl = "https://inside.fifa.com/fifa-world-ranking/men";
export const officialRankingUpdatedAt = "1 abr 2026";
