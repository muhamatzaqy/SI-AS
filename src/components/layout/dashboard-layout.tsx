import { type Profile } from '@/types'
import { Sidebar } from './sidebar'

export function DashboardLayout({ user, children }: { user: Profile; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background lg:flex">
      <Sidebar user={user} />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 animate-fade-in">
          <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">{children}</div>
        </main>
      </div>
    </div>
  )
}