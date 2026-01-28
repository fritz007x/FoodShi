'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { cn, formatAddress, getInitials } from '@/lib/utils';
import {
  Heart,
  Home,
  Gift,
  User,
  Trophy,
  Wallet,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
} from 'lucide-react';

const navItems = [
  { href: '/feed', label: 'Feed', icon: Home },
  { href: '/donations', label: 'Donations', icon: Gift },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/rewards', label: 'Rewards', icon: Heart },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/feed" className="flex items-center gap-2">
              <Heart className="h-8 w-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900 hidden sm:block">FOODSHI</span>
            </Link>

            <div className="flex items-center gap-4">
              {/* Karma Display */}
              <div className="hidden sm:flex items-center gap-2 bg-primary-50 px-3 py-1.5 rounded-full">
                <Heart className="h-4 w-4 text-primary-600" />
                <span className="text-sm font-medium text-primary-700">
                  {user.karmaPoints} Karma
                </span>
              </div>

              {/* Donate Button */}
              <Link href="/donate" className="btn-primary">
                <Plus className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Donate</span>
              </Link>

              {/* Profile Dropdown */}
              <Link
                href={`/profile/${user.id}`}
                className="flex items-center gap-2 hover:bg-gray-100 rounded-lg p-2"
              >
                {user.profilePic ? (
                  <img
                    src={user.profilePic}
                    alt={user.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium text-sm">
                    {getInitials(user.name)}
                  </div>
                )}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Sidebar Navigation - Desktop */}
          <aside className="hidden lg:block w-64 shrink-0">
            <nav className="sticky top-24 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
              <hr className="my-4" />
              <Link
                href="/settings"
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors',
                  pathname === '/settings'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Settings className="h-5 w-5" />
                Settings
              </Link>
              <button
                onClick={() => {
                  logout();
                  router.push('/');
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-100 w-full"
              >
                <LogOut className="h-5 w-5" />
                Log out
              </button>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>

      {/* Bottom Navigation - Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-40">
        <div className="flex justify-around">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center py-2 px-3 text-xs',
                  isActive ? 'text-primary-600' : 'text-gray-500'
                )}
              >
                <Icon className="h-6 w-6 mb-1" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Spacer for mobile bottom nav */}
      <div className="lg:hidden h-16" />
    </div>
  );
}
