import { prisma } from "@/lib/prisma";

export async function GET() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      predictions: { select: { points: true } },
    },
  });

  const ranking = users
    .map((user) => ({
      id: user.id,
      name: user.name,
      points: user.predictions.reduce((sum, prediction) => sum + prediction.points, 0),
      predictions: user.predictions.length,
    }))
    .sort((a, b) => b.points - a.points || b.predictions - a.predictions);

  return Response.json({ ranking });
}
