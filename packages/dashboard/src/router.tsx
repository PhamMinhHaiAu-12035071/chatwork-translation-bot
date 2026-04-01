import { createBrowserRouter } from 'react-router'
import { AppLayout } from '~/layouts/app-layout'
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
      { path: '/free-rooms', element: <FreeRoomListPage /> },
      { path: '/free-rooms/new', element: <FreeRoomCreatePage /> },
      { path: '/free-rooms/:id', element: <FreeRoomDetailPage /> },
      { path: '/guide', element: <WebhookGuidePage /> },
    ],
  },
])
