import { useEffect, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import { useUiStore, selectFreeRoomEnabled } from '~/stores/ui-store'

interface FreeRoomGuardProps {
  children: React.ReactNode
}

function readFreeRoomEnabled() {
  return selectFreeRoomEnabled(useUiStore.getState())
}

export function FreeRoomGuard({ children }: FreeRoomGuardProps) {
  const enabled = useSyncExternalStore(
    useUiStore.subscribe,
    readFreeRoomEnabled,
    readFreeRoomEnabled,
  )
  const navigate = useNavigate()

  useEffect(() => {
    if (!enabled) void navigate('/', { replace: true })
  }, [enabled, navigate])

  if (!enabled) return null
  return <>{children}</>
}
