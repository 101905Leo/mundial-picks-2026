type PredictionWithRoom = {
  userId?: string;
  matchId?: string;
  leagueId: string | null;
  roomKey?: string;
};

export function pickRoomPrediction<T extends PredictionWithRoom>(predictions: T[], roomId: string) {
  const roomPrediction = predictions.find(
    (prediction) => prediction.leagueId === roomId || prediction.roomKey === roomId,
  );

  return roomPrediction ?? predictions.find((prediction) => prediction.leagueId === null && prediction.roomKey === "GLOBAL");
}

export function uniqueRoomPredictions<T extends PredictionWithRoom>(predictions: T[], roomId: string) {
  const grouped = new Map<string, T[]>();

  for (const prediction of predictions) {
    const key = `${prediction.userId ?? ""}:${prediction.matchId ?? ""}`;
    grouped.set(key, [...(grouped.get(key) ?? []), prediction]);
  }

  return [...grouped.values()]
    .map((items) => pickRoomPrediction(items, roomId))
    .filter((prediction): prediction is T => Boolean(prediction));
}
