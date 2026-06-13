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

export function matchBelongsToRoomScope(
  match: { roomId: string | null; competitionId: string | null },
  room: RoomMatchScope,
) {
  if (match.roomId === room.id) return true;
  if (match.roomId !== null) return false;
  return room.competitionId ? match.competitionId === room.competitionId : true;
}
