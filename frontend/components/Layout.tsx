'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Sidebar, SidebarToggle } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  /** Page title shown in the top bar */
  title?: string;
  /** Optional actions rendered to the right of the title */
  actions?: React.ReactNode;
}

/**
 * App shell used by all authenticated pages.
 * Wraps content with the persistent sidebar + a simple top bar.
 * Auth pages (login/signup) should NOT use this component.
 */
export function Layout({ children, title, actions }: LayoutProps) {
  const router          = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated        = useAuthStore((s) => s._hydrated);

  // Redirect unauthenticated users to login — only after hydration
  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated || !isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 shadow-sm">
          <SidebarToggle />
          {title && (
            <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
          )}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
