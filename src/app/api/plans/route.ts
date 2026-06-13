import { prisma } from "@/lib/prisma";

export async function GET() {
  const plans = await prisma.roomPlan.findMany({
    where: { isActive: true },
    orderBy: [{ participantLimit: "asc" }, { priceInCents: "asc" }],
  });

  return Response.json({ plans });
}
