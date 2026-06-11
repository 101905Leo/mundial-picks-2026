import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  phone: string;
  name: string;
  role: "USER" | "ADMIN";
  isActive: boolean;
  entryPaidAt: Date | null;
  hasLeagueAccess?: boolean;
};

const tokenName = "mundial_picks_token";

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }
  return secret;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(user: SessionUser) {
  return jwt.sign(user, jwtSecret(), { expiresIn: "7d" });
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(tokenName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(tokenName);
}

export async function getSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(tokenName)?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, jwtSecret()) as SessionUser;
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        isActive: true,
        entryPaidAt: true,
        _count: { select: { leagues: true } },
      },
    });
    if (!user) return null;

    const { _count, ...sessionUser } = user;
    return { ...sessionUser, hasLeagueAccess: _count.leagues > 0 };
  } catch {
    return null;
  }
}

export async function requireUser(request: NextRequest) {
  const user = await getSessionFromRequest(request);
  if (!user) {
    return { user: null, response: Response.json({ error: "No autenticado" }, { status: 401 }) };
  }
  return { user, response: null };
}

export async function requireAdmin(request: NextRequest) {
  const result = await requireUser(request);
  if (result.response) return result;
  if (!result.user?.isActive) {
    return { user: null, response: Response.json({ error: "Administrador desactivado" }, { status: 403 }) };
  }
  if (result.user?.role !== "ADMIN") {
    return { user: null, response: Response.json({ error: "Solo administradores" }, { status: 403 }) };
  }
  return result;
}
