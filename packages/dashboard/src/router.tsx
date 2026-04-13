import { createBrowserRouter } from 'react-router'
import { AppLayout } from '~/layouts/app-layout'
import { FreeRoomGuard } from '~/components/organisms/free-room-guard'
import { FreeRoomCreatePage } from '~/pages/free-room-create'
import { FreeRoomDetailPage } from '~/pages/free-room-detail'
import { FreeRoomListPage } from '~/pages/free-rooms'
import { RoomListPage } from '~/pages/room-list'
import { RoomCreatePage } from '~/pages/room-create'
import { RoomDetailPage } from '~/pages/room-detail'
import { WebhookGuidePage } from '~/pages/webhook-guide'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <RoomListPage /> },
      { path: '/rooms/new', element: <RoomCreatePage /> },
      { path: '/rooms/:id', element: <RoomDetailPage /> },
      {
        path: '/free-rooms',
        element: (
          <FreeRoomGuard>
            <FreeRoomListPage />
          </FreeRoomGuard>
        ),
      },
      {
        path: '/free-rooms/new',
        element: (
          <FreeRoomGuard>
            <FreeRoomCreatePage />
          </FreeRoomGuard>
        ),
      },
      {
        path: '/free-rooms/:id',
        element: (
          <FreeRoomGuard>
            <FreeRoomDetailPage />
          </FreeRoomGuard>
        ),
      },
      { path: '/guide', element: <WebhookGuidePage /> },
    ],
  },
])
