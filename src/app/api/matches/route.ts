import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { visiblePredictionPoints } from "@/lib/prediction-points";

type MatchWithPredictions = Awaited<ReturnType<typeof prisma.match.findMany>>[number] & {
  predictions?: Array<{
    id: string;
    homeScore: number;
    awayScore: number;
    points: number;
    manualPoints: number | null;
    updatedAt: Date;
  }>;
};

function normalizeMatchTeam(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  const aliases: Record<string, string> = {
    usa: "unitedstates",
    unitedstatesofamerica: "unitedstates",
    usmnt: "unitedstates",
  };

  return aliases[normalized] ?? normalized;
}

function matchIdentity(match: MatchWithPredictions) {
  const kickoffMinute = match.startsAt.toISOString().slice(0, 16);

  return [
    match.roomId ?? "GLOBAL",
    match.competitionId ?? "NO_COMPETITION",
    normalizeMatchTeam(match.homeTeam),
    normalizeMatchTeam(match.awayTeam),
    kickoffMinute,
  ].join("|");
}

function matchPriority(match: MatchWithPredictions) {
  let priority = 0;
  if (match.isPublished) priority += 100;
  if (match.status === "FINISHED") priority += 40;
  if (match.status === "LIVE") priority += 30;
  if (match.homeScore !== null && match.awayScore !== null) priority += 20;
  if (match.sourceKey?.startsWith("openfootball-worldcup-2026")) priority += 10;
  if (match.predictions && Array.isArray(match.predictions) && match.predictions.length > 0) priority += 5;
  return priority;
}

function dedupeMatches(matches: MatchWithPredictions[]) {
  const byIdentity = new Map<string, MatchWithPredictions>();

  for (const match of matches) {
    const key = matchIdentity(match);
    const current = byIdentity.get(key);
    if (!current || matchPriority(match) > matchPriority(current)) {
      byIdentity.set(key, match);
    }
  }

  return [...byIdentity.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request);
  const includeHidden = request.nextUrl.searchParams.get("includeHidden") === "true" && user?.role === "ADMIN";
  const includeRoomMatches = request.nextUrl.searchParams.get("includeRooms") === "true" && user?.role === "ADMIN";

  const matches = await prisma.match.findMany({
    where: includeHidden
      ? includeRoomMatches
        ? {}
        : { roomId: null }
      : { isPublished: true, roomId: null },
    orderBy: { startsAt: "asc" },
    include: {
      predictions: user
        ? {
            where: { userId: user.id, roomKey: "GLOBAL" },
            select: { id: true, homeScore: true, awayScore: true, points: true, manualPoints: true, updatedAt: true },
          }
        : false,
    },
  });

  const visibleMatches = dedupeMatches(matches as MatchWithPredictions[]);

  return Response.json({
    matches: visibleMatches.map((match) => ({
      ...match,
      predictions: Array.isArray(match.predictions)
        ? match.predictions.map((prediction) => ({
            ...prediction,
            points: visiblePredictionPoints(prediction, match),
          }))
        : match.predictions,
    })),
  });
}
