import { Outlet } from 'react-router'
import { Sidebar } from './sidebar'

export function MainLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 dark:bg-dark-9">
      {/* Sidebar Wrapper */}
      <div className="shrink-0 z-40 h-full shadow-xl shadow-gray-200/50 dark:shadow-none">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto overflow-x-hidden relative scroll-smooth">
        <div className="min-h-full w-full max-w-[1600px] mx-auto p-4 md:p-6 fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
