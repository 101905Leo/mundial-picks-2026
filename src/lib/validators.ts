import { z } from "zod";

export const credentialsSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,20}$/, "Numero celular invalido")
    .transform((value) => value.replace(/[\s-]/g, "")),
  password: z.string().min(6),
});

export const registerSchema = credentialsSchema.extend({
  name: z.string().min(2).max(80),
});

export const matchSchema = z.object({
  homeTeam: z.string().min(2),
  awayTeam: z.string().min(2),
  group: z.string().optional(),
  venue: z.string().optional(),
  broadcastUrl: z.string().url().optional().or(z.literal("")),
  startsAt: z.string().datetime(),
});

export const broadcastUrlSchema = z.object({
  broadcastUrl: z.string().url().optional().or(z.literal("")),
});

export const resultSchema = z.object({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
});

export const predictionSchema = resultSchema.extend({
  matchId: z.string().min(1),
});

export const leagueSchema = z.object({
  name: z.string().min(3).max(80),
});

export const joinLeagueSchema = z.object({
  inviteCode: z.string().min(4).max(16),
});
