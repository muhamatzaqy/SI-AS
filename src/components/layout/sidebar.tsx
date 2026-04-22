'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { type Profile } from '@/types'
import { LayoutDashboard, Users, Calendar, ClipboardList, FileText, CreditCard, BarChart3, AlertTriangle, Eye, Camera, Clock, LogOut, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'
import { useState } from 'react'

const pengelolaNav = [
  { href: '/pengelola', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pengelola/users', label: 'Mahasiswa', icon: Users },
  { href: '/pengelola/jadwal', label: 'Jadwal Ngaji', icon: Calendar },
  { href: '/pengelola/presensi', label: 'Presensi', icon: ClipboardList },
  { href: '/pengelola/perizinan', label: 'Perizinan', icon: FileText },
  { href: '/pengelola/keuangan', label: 'Keuangan SPP', icon: CreditCard },
  { href: '/pengelola/laporan', label: 'Laporan', icon: BarChart3 },
]
const pengurusNav = [
  { href: '/pengurus', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pengurus/kegiatan', label: 'Kegiatan', icon: Calendar },
  { href: '/pengurus/pelanggaran', label: 'Pelanggaran', icon: AlertTriangle },
  { href: '/pengurus/monitoring', label: 'Monitoring', icon: Eye },
]
const mahasiswaNav = [
  { href: '/mahasiswa', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/mahasiswa/absensi', label: 'Absensi', icon: Camera },
  { href: '/mahasiswa/perizinan', label: 'Perizinan', icon: FileText },
  { href: '/mahasiswa/keuangan', label: 'Keuangan', icon: CreditCard },
  { href: '/mahasiswa/riwayat', label: 'Riwayat', icon: Clock },
]

const roleBadgeClass: Record<string, string> = {
  pengelola: 'bg-amber-400/20 text-amber-200 border border-amber-400/30',
  pengurus: 'bg-blue-400/20 text-blue-200 border border-blue-400/30',
  mahasiswa: 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30',
}

export function Sidebar({ user }: { user: Profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const supabase = createClient()

  const navItems = user.role === 'pengelola' ? pengelolaNav : user.role === 'pengurus' ? pengurusNav : mahasiswaNav
  const roleLabel = user.role === 'pengelola' ? 'Pengelola' : user.role === 'pengurus' ? 'Pengurus' : 'Mahasiswa'

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

  const NavContent = () => (
    <div className="flex h-full flex-col">
      {/* Header with Islamic ornament */}
      <div className="relative overflow-hidden border-b border-white/10 px-5 py-5">
        <div className="absolute inset-0 islamic-pattern opacity-10" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 shadow-lg">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <p className="font-bold leading-none text-white tracking-wide">SANGAR</p>
            <p className="text-xs text-white/60 mt-0.5">Ma&apos;had Aly &amp; LKIM</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4 overflow-y-auto">
        {navItems.map((item, idx) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{ animationDelay: `${idx * 50}ms` }}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 animate-slide-in-left',
                isActive
                  ? 'bg-white/20 text-white shadow-sm border-l-2 border-amber-400 pl-[10px]'
                  : 'text-white/70 hover:bg-white/10 hover:text-white hover:translate-x-0.5'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0 transition-transform duration-200', isActive ? 'text-amber-300' : 'group-hover:scale-110')} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User profile footer */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-xl p-2.5 bg-white/10 backdrop-blur-sm">
          <Avatar className="h-9 w-9 ring-2 ring-amber-400/50 ring-offset-1 ring-offset-transparent">
            <AvatarFallback className="bg-amber-400/20 text-amber-200 text-xs font-bold">
              {getInitials(user.nama)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user.nama}</p>
            <span className={cn('inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-4', roleBadgeClass[user.role] ?? roleBadgeClass.mahasiswa)}>
              {roleLabel}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-8 w-8 shrink-0 text-white/60 hover:text-white hover:bg-white/10 rounded-lg"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center border-b bg-primary px-4 py-3 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(!open)}
          className="mr-3 text-white hover:bg-white/10 hover:text-white"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="font-bold text-white">SANGAR</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 shadow-2xl transition-transform duration-300 ease-in-out lg:hidden',
          'islamic-gradient',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <NavContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block islamic-gradient">
        <div className="sticky top-0 h-screen">
          <NavContent />
        </div>
      </aside>
    </>
  )
}
