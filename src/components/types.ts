export type User = {
  id: string;
  name: string;
  phone: string;
  role: "USER" | "ADMIN";
  isActive: boolean;
  entryPaidAt: string | null;
  hasLeagueAccess?: boolean;
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
  exactScores?: number;
  currentStreak?: number;
  weeklyPoints?: number;
};

export type LeagueMember = RankingEntry & {
  isActive: boolean;
  entryPaidAt: string | null;
  roomRole?: "MEMBER" | "ADMIN";
};

export type League = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  competitionId?: string | null;
  maxParticipants: number;
  status?: "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CLOSED";
  expiresAt?: string | null;
  description?: string | null;
  rules?: string | null;
  planId?: string | null;
  paymentStatus?: string;
  paymentAmountInCents?: number;
  paidAt?: string | null;
  competition?: {
    id: string;
    name: string;
    season: string;
    country: string | null;
  } | null;
  memberships?: { id: string; userId: string; role: "MEMBER" | "ADMIN" }[];
  plan?: {
    id: string;
    slug: string;
    name: string;
    participantLimit: number | null;
    durationDays: number;
    priceInCents: number;
    benefits: string[];
  } | null;
};

export type RoomPlan = {
  id: string;
  slug: string;
  name: string;
  participantLimit: number | null;
  durationDays: number;
  priceInCents: number;
  benefits: string[];
};

export type Competition = {
  id: string;
  slug: string;
  name: string;
  country: string | null;
  season: string;
};
