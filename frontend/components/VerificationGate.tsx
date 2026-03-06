'use client';

import { AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { WorldIdVerify } from './WorldIdVerify';

interface VerificationGateProps {
  children: React.ReactNode;
}

export function VerificationGate({ children }: VerificationGateProps) {
  const { user } = useAuthStore();

  if (user?.isVerified) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              World ID verification required
            </p>
            <p className="mt-1 text-xs text-amber-600">
              Verify your identity to prevent sybil attacks and unlock this feature.
            </p>
          </div>
        </div>
        <WorldIdVerify />
      </div>
      <div className="pointer-events-none opacity-40">
        {children}
      </div>
    </div>
  );
}
