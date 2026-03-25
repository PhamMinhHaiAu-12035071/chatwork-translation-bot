import { useParams } from 'react-router'

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Room Detail</h2>
      <p className="text-gray-500">Room config ID: {id}</p>
    </div>
  )
}
