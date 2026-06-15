type PredictionWithRoom = {
  userId?: string;
  matchId?: string;
  leagueId: string | null;
  roomKey?: string;
  updatedAt?: Date | string;
  match?: {
    competitionId?: string | null;
    roomId?: string | null;
    homeTeam: string;
    awayTeam: string;
    startsAt: Date | string;
  };
};

function normalizeTeam(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  const aliases: Record<string, string> = {
    usa: "unitedstates",
    unitedstatesofamerica: "unitedstates",
    usmnt: "unitedstates",
    korearepublic: "southkorea",
    republicofkorea: "southkorea",
    iriran: "iran",
    coteivoire: "ivorycoast",
    ctedivoire: "ivorycoast",
  };

  return aliases[normalized] ?? normalized;
}

function matchGroupKey(prediction: PredictionWithRoom) {
  if (!prediction.match) return prediction.matchId ?? "";
  const startsAt = prediction.match.startsAt instanceof Date ? prediction.match.startsAt : new Date(prediction.match.startsAt);
  const kickoffDay = Number.isNaN(startsAt.getTime()) ? "" : startsAt.toISOString().slice(0, 10);

  return [
    prediction.match.competitionId ?? "NO_COMPETITION",
    normalizeTeam(prediction.match.homeTeam),
    normalizeTeam(prediction.match.awayTeam),
    kickoffDay,
  ].join("|");
}

function timestamp(value?: Date | string) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function pickRoomPrediction<T extends PredictionWithRoom>(predictions: T[], roomId: string) {
  const latestFirst = [...predictions].sort((left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt));
  const roomPrediction = latestFirst.find((prediction) => prediction.leagueId === roomId || prediction.roomKey === roomId);

  return roomPrediction ?? latestFirst.find((prediction) => prediction.leagueId === null && prediction.roomKey === "GLOBAL");
}

export function uniqueRoomPredictions<T extends PredictionWithRoom>(predictions: T[], roomId: string) {
  const grouped = new Map<string, T[]>();

  for (const prediction of predictions) {
    const key = `${prediction.userId ?? ""}:${matchGroupKey(prediction)}`;
    grouped.set(key, [...(grouped.get(key) ?? []), prediction]);
  }

  return [...grouped.values()]
    .map((items) => pickRoomPrediction(items, roomId))
    .filter((prediction): prediction is T => Boolean(prediction));
}
