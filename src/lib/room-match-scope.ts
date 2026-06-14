type RoomMatchScope = {
  id: string;
  competitionId: string | null;
};

export function roomMatchScopeWhere(room: RoomMatchScope) {
  return {
    OR: room.competitionId
      ? [
          { roomId: room.id },
          { roomId: null, competitionId: room.competitionId },
        ]
      : [
          { roomId: room.id },
          { roomId: null },
        ],
  };
}

export function roomOwnedMatchWhere(room: RoomMatchScope) {
  return { roomId: room.id };
}

export function roomGlobalFallbackMatchWhere(room: RoomMatchScope) {
  return room.competitionId ? { roomId: null, competitionId: room.competitionId } : { roomId: null };
}

export function matchBelongsToRoomScope(
  match: { roomId: string | null; competitionId: string | null },
  room: RoomMatchScope,
) {
  if (match.roomId === room.id) return true;
  if (match.roomId !== null) return false;
  return room.competitionId ? match.competitionId === room.competitionId : true;
}

export function matchBelongsToResolvedRoomScope(
  match: { roomId: string | null; competitionId: string | null },
  room: RoomMatchScope,
  useOwnedMatchesOnly: boolean,
) {
  if (useOwnedMatchesOnly) return match.roomId === room.id;
  if (match.roomId !== null) return false;
  return room.competitionId ? match.competitionId === room.competitionId : true;
}
