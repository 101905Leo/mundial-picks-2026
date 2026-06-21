import { z } from "zod";

export function normalizeColombianMobilePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const withoutInternationalPrefix = digits.startsWith("0057") ? digits.slice(4) : digits;
  const withoutCountryCode =
    withoutInternationalPrefix.startsWith("57") && withoutInternationalPrefix.length === 12
      ? withoutInternationalPrefix.slice(2)
      : withoutInternationalPrefix;

  return withoutCountryCode;
}

const colombianMobilePhoneSchema = z
  .string()
  .trim()
  .transform(normalizeColombianMobilePhone)
  .refine((value) => /^3\d{9}$/.test(value), {
    message: "Ingresa un celular colombiano valido de 10 digitos que empiece por 3",
  });

export const credentialsSchema = z.object({
  phone: colombianMobilePhoneSchema,
  password: z.string().refine((value) => /^\d{4}$/.test(value) || value.length >= 6, {
    message: "Ingresa tu PIN de 4 numeros",
  }),
});

const fourDigitPinSchema = z.string().regex(/^\d{4}$/, "El PIN debe tener exactamente 4 numeros");

export const registerSchema = z.object({
  phone: colombianMobilePhoneSchema,
  password: fourDigitPinSchema,
  name: z.string().trim().min(2).max(80),
  inviteCode: z.string().trim().max(16).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().refine((value) => /^\d{4}$/.test(value) || value.length >= 6, {
    message: "Ingresa tu PIN actual",
  }),
  newPassword: fourDigitPinSchema,
});

export const adminResetPasswordSchema = z.object({
  newPassword: fourDigitPinSchema,
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
  isFinal: z.boolean().default(false),
});

export const predictionSchema = resultSchema.extend({
  matchId: z.string().min(1),
});

export const leagueSchema = z.object({
  name: z.string().min(3).max(80),
  competitionId: z.string().min(1).optional(),
  maxParticipants: z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20),
  description: z.string().trim().max(500).optional(),
  rules: z.string().trim().max(3000).optional(),
  firstMatch: z
    .object({
      homeTeam: z.string().trim().min(2),
      awayTeam: z.string().trim().min(2),
      startsAt: z.string().datetime(),
    })
    .optional(),
});

export const joinLeagueSchema = z.object({
  inviteCode: z.string().min(4).max(16),
});
