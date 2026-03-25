import { NavLink, Outlet } from 'react-router'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/rooms/new', label: '+ New Room' },
  { to: '/guide', label: 'Webhook Guide' },
] as const

export function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-gray-200 bg-white p-6">
        <h1 className="mb-8 text-xl font-bold">Translation Bot</h1>
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 text-sm transition-colors ${
                  isActive ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
