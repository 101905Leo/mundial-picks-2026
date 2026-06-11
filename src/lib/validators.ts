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
  password: z.string().min(6),
});

export const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(80),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8, "La nueva contrasena debe tener minimo 8 caracteres"),
});

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(8, "La nueva contrasena debe tener minimo 8 caracteres"),
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
