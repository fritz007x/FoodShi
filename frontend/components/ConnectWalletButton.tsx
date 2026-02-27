'use client';

import { useEffect, useRef } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';

/**
 * Renders the RainbowKit ConnectButton and, once a wallet is connected,
 * automatically links it to the authenticated user's account via the backend.
 * Safe to mount multiple times — linking is idempotent and deduplicated by ref.
 */
export function ConnectWalletButton() {
  const { address, isConnected } = useAccount();
  const { isAuthenticated, user, updateUser } = useAuthStore();
  const lastLinked = useRef<string | null>(null);

  useEffect(() => {
    // Only run when authenticated, connected, and the address is new
    if (!isAuthenticated || !isConnected || !address) return;
    if (address === user?.walletAddress) return;
    if (address === lastLinked.current) return;

    lastLinked.current = address;

    api
      .post<{ walletAddress: string }>('/auth/link-wallet', { walletAddress: address })
      .then(({ data }) => {
        updateUser({ walletAddress: data.walletAddress });
        toast.success('Wallet linked!');
      })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Failed to link wallet';
        toast.error(msg);
        lastLinked.current = null; // allow retry
      });
  }, [address, isConnected, isAuthenticated, user?.walletAddress, updateUser]);

  return <ConnectButton chainStatus="none" showBalance={false} />;
}
