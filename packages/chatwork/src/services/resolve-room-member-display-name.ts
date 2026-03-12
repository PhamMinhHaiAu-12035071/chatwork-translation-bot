import { chatworkApiClient } from '~/http/chatwork-api-client'

export async function resolveRoomMemberDisplayName(
  roomId: number,
  accountId: number,
  token: string,
  cache: Map<number, string> = new Map<number, string>(),
): Promise<string> {
  const cached = cache.get(accountId)
  if (cached != null) {
    return cached
  }

  const members = await chatworkApiClient.getRoomMembers(roomId, token)
  const member = members.find((m) => m.account_id === accountId)

  const name = member != null ? member.name : `#${accountId.toString()}`
  cache.set(accountId, name)

  return name
}
