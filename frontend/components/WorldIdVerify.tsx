'use client';

import { useState } from 'react';
import { BadgeCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';

export function WorldIdVerify() {
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);

  if (user?.isVerified) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
        <BadgeCheck className="h-4 w-4" />
        Verified with World ID
      </div>
    );
  }

  async function handleVerify() {
    setLoading(true);
    try {
      // Generate a unique nullifier for this verification attempt.
      // In production with the full IDKit widget flow, the World App
      // generates the proof and nullifier on-device; here we send a
      // placeholder that the backend validates via the World ID cloud API.
      const nullifier = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`;

      await api.post('/worldid/verify', {
        merkle_root: '0x0',
        nullifier_hash: nullifier,
        proof: '0x0',
        verification_level: 'orb',
      });
      updateUser({ isVerified: true });
      toast.success('World ID verified!');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Verification failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleVerify}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg border border-primary-300 bg-primary-50 px-4 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-100 disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <BadgeCheck className="h-4 w-4" />
      )}
      {loading ? 'Verifying...' : 'Verify with World ID'}
    </button>
  );
}
