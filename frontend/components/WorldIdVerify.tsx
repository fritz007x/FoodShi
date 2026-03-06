'use client';

import { IDKitWidget, VerificationLevel, type ISuccessResult } from '@worldcoin/idkit';
import { BadgeCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';

export function WorldIdVerify() {
  const { user, updateUser } = useAuthStore();

  if (user?.isVerified) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
        <BadgeCheck className="h-4 w-4" />
        Verified with World ID
      </div>
    );
  }

  async function handleVerify(result: ISuccessResult) {
    try {
      await api.post('/worldid/verify', {
        merkle_root: result.merkle_root,
        nullifier_hash: result.nullifier_hash,
        proof: result.proof,
        verification_level: result.verification_level,
      });
      updateUser({ isVerified: true });
      toast.success('World ID verified!');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Verification failed';
      toast.error(msg);
    }
  }

  const appId = process.env.NEXT_PUBLIC_WORLDID_APP_ID || '';
  const action = process.env.NEXT_PUBLIC_WORLDID_ACTION || 'verify-donor';

  return (
    <IDKitWidget
      app_id={appId as `app_${string}`}
      action={action}
      verification_level={VerificationLevel.Orb}
      onSuccess={handleVerify}
    >
      {({ open }) => (
        <button
          type="button"
          onClick={open}
          className="flex items-center gap-2 rounded-lg border border-primary-300 bg-primary-50 px-4 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-100"
        >
          <BadgeCheck className="h-4 w-4" />
          Verify with World ID
        </button>
      )}
    </IDKitWidget>
  );
}
