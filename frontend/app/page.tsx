'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

export default function RootPage() {
  const router          = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    router.replace(isAuthenticated ? '/feed' : '/login');
  }, [isAuthenticated, router]);

  return null;
}
