export function findRoom(state, code) {
  return state.rooms?.[code] ?? null;
}

export function ensureAdmin(room) {
  if (room.players.some((player) => player.id === room.adminId)) return;
  room.adminId = room.players[0]?.id ?? null;
}
