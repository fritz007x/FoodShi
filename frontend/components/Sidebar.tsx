'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Heart,
  Package,
  Star,
  Trophy,
  Wallet,
  User,
  Settings,
  LogOut,
  Leaf,
  Menu,
  X,
} from 'lucide-react';
import { useAuthStore, useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/feed',        label: 'Feed',        icon: Home    },
  { href: '/donate',      label: 'Donate',      icon: Heart   },
  { href: '/donations',   label: 'Donations',   icon: Package },
  { href: '/rewards',     label: 'Rewards',     icon: Star    },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy  },
  { href: '/wallet',      label: 'Wallet',      icon: Wallet  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout }        = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-white border-r border-gray-200 transition-transform duration-200',
          'lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-gray-100">
          <Link href="/feed" className="flex items-center gap-2">
            <Leaf className="h-6 w-6 text-primary-600" />
            <span className="text-lg font-bold text-gray-900">FOODSHI</span>
          </Link>
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-primary-600' : 'text-gray-400')} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-gray-100 p-3 space-y-1">
          {user && (
            <>
              <Link
                href={`/profile/${user.id}`}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  pathname.startsWith('/profile')
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <User className="h-5 w-5 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <p className="truncate">{user.username}</p>
                  <p className="text-xs text-gray-400 font-normal">{user.karmaPoints} karma</p>
                </div>
              </Link>

              <Link
                href="/settings"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <Settings className="h-5 w-5 shrink-0 text-gray-400" />
                Settings
              </Link>
            </>
          )}

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0 text-gray-400" />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}

// Hamburger toggle button — rendered inside the top bar of each page
export function SidebarToggle() {
  const { toggleSidebar } = useUIStore();
  return (
    <button
      onClick={toggleSidebar}
      className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 lg:hidden"
      aria-label="Toggle sidebar"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
