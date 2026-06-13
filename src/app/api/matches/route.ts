import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request);
  const includeHidden = request.nextUrl.searchParams.get("includeHidden") === "true" && user?.role === "ADMIN";

  const matches = await prisma.match.findMany({
    where: includeHidden ? {} : { isPublished: true, roomId: null },
    orderBy: { startsAt: "asc" },
    include: {
      predictions: user
        ? {
            where: { userId: user.id },
            select: { id: true, homeScore: true, awayScore: true, points: true },
          }
        : false,
    },
  });

  return Response.json({ matches });
}
