import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";
import { visiblePredictionPoints } from "@/lib/prediction-points";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
      entryPaidAt: true,
      predictions: {
        select: {
          points: true,
          manualPoints: true,
          homeScore: true,
          awayScore: true,
          updatedAt: true,
          match: { select: { status: true, homeScore: true, awayScore: true, updatedAt: true } },
        },
      },
      _count: {
        select: {
          predictions: true,
        },
      },
    },
  });

  return Response.json({
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      entryPaidAt: user.entryPaidAt,
      picksCount: user._count.predictions,
      points: user.predictions.reduce(
        (sum, prediction) => sum + visiblePredictionPoints(prediction, prediction.match),
        0,
      ),
    })),
  });
}

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const body = await request.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    const error = parsed.error.issues[0]?.message ?? "Datos de usuario invalidos";
    return Response.json({ error }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { phone: parsed.data.phone },
  });

  if (existingUser) {
    return Response.json({ error: "Ese numero de WhatsApp ya esta registrado" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      passwordHash: await hashPassword(parsed.data.password),
      isActive: false,
    },
    select: { id: true, name: true, phone: true, role: true, isActive: true, entryPaidAt: true },
  });

  return Response.json({
    user: {
      ...user,
      picksCount: 0,
      points: 0,
    },
  }, { status: 201 });
}
