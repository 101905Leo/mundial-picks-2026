export type User = {
  id: string;
  name: string;
  phone: string;
  role: "USER" | "ADMIN";
  isActive: boolean;
  entryPaidAt: string | null;
};

export type Prediction = {
  id: string;
  homeScore: number;
  awayScore: number;
  points: number;
};

export type Match = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  group: string | null;
  venue: string | null;
  startsAt: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  isPublished: boolean;
  broadcastUrl: string | null;
  predictions?: Prediction[];
};

export type RankingEntry = {
  id: string;
  name: string;
  points: number;
  predictions: number;
};

export type League = {
  id: string;
  name: string;
  inviteCode: string;
  memberships?: { id: string }[];
};
