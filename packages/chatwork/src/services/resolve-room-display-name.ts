import { getRoom } from './get-room'

export async function resolveRoomDisplayName(
  roomId: number,
  token: string,
  cache?: Map<number, string>,
): Promise<string> {
  const _cache = cache ?? new Map<number, string>()

  // Check cache first
  const cached = _cache.get(roomId)
  if (cached !== undefined) {
    return cached
  }

  try {
    const room = await getRoom(roomId, token)
    _cache.set(roomId, room.name)
    return room.name
  } catch {
    // On any error, return fallback without throwing
    return `Room #${String(roomId)}`
  }
}
