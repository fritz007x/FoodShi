'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Loader2, Shield, ShieldCheck, Lock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import {
  SHARE_TOKEN_ADDRESS,
  STAKING_ADDRESS,
  shareTokenAbi,
  stakingAbi,
} from '@/lib/contracts';
import { cn } from '@/lib/utils';

export default function WalletPage() {
  const { address, isConnected } = useAccount();

  return (
    <Layout title="Wallet">
      <div className="mx-auto max-w-lg space-y-6">
        {/* Connect wallet card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Wallet Connection</h2>
          <ConnectWalletButton />
        </div>

        {isConnected && address && SHARE_TOKEN_ADDRESS && STAKING_ADDRESS ? (
          <>
            <BalanceCard address={address} />
            <StakingCard address={address} />
          </>
        ) : isConnected ? (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5 text-sm text-yellow-800">
            <AlertTriangle className="inline h-4 w-4 mr-1.5" />
            Contract addresses not configured. Set NEXT_PUBLIC_SHARE_TOKEN_ADDRESS and NEXT_PUBLIC_STAKING_ADDRESS in .env.local.
          </div>
        ) : null}
      </div>
    </Layout>
  );
}

// ── Balance card ──────────────────────────────────────────────────────────────

function BalanceCard({ address }: { address: `0x${string}` }) {
  const { data: balance, isLoading } = useReadContract({
    address: SHARE_TOKEN_ADDRESS!,
    abi: shareTokenAbi,
    functionName: 'balanceOf',
    args: [address],
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-gray-700">$SHARE Balance</h2>
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      ) : (
        <p className="text-2xl font-bold text-gray-900">
          {balance !== undefined ? Number(formatEther(balance)).toLocaleString() : '—'}
          <span className="ml-1.5 text-sm font-normal text-gray-400">SHARE</span>
        </p>
      )}
    </div>
  );
}

// ── Staking card ──────────────────────────────────────────────────────────────

function StakingCard({ address }: { address: `0x${string}` }) {
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');

  // Read stake info
  const { data: stakeInfo, refetch: refetchStake } = useReadContract({
    address: STAKING_ADDRESS!,
    abi: stakingAbi,
    functionName: 'getStakeInfo',
    args: [address],
  });

  const { data: unlockRemaining } = useReadContract({
    address: STAKING_ADDRESS!,
    abi: stakingAbi,
    functionName: 'getUnlockTimeRemaining',
    args: [address],
  });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: SHARE_TOKEN_ADDRESS!,
    abi: shareTokenAbi,
    functionName: 'balanceOf',
    args: [address],
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: SHARE_TOKEN_ADDRESS!,
    abi: shareTokenAbi,
    functionName: 'allowance',
    args: [address, STAKING_ADDRESS!],
  });

  // Write contracts
  const { writeContract: approve, data: approveTxHash, isPending: approving, reset: resetApprove } = useWriteContract();
  const { writeContract: stakeWrite, data: stakeTxHash, isPending: staking } = useWriteContract();
  const { writeContract: unstakeWrite, data: unstakeTxHash, isPending: unstaking } = useWriteContract();
  const { writeContract: activateSuper, data: superTxHash, isPending: activatingSuper } = useWriteContract();

  // Track the amount to stake after approval is confirmed
  const pendingStakeAmount = useRef<bigint | null>(null);

  // Wait for txs
  const { isLoading: waitingApprove, isSuccess: approveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    query: { enabled: !!approveTxHash },
  });
  const { isLoading: waitingStake } = useWaitForTransactionReceipt({
    hash: stakeTxHash,
    query: { enabled: !!stakeTxHash },
  });
  const { isLoading: waitingUnstake } = useWaitForTransactionReceipt({
    hash: unstakeTxHash,
    query: { enabled: !!unstakeTxHash },
  });
  const { isLoading: waitingSuper } = useWaitForTransactionReceipt({
    hash: superTxHash,
    query: { enabled: !!superTxHash },
  });

  // Once approval is mined, fire the stake transaction
  useEffect(() => {
    if (approveConfirmed && pendingStakeAmount.current !== null) {
      const amount = pendingStakeAmount.current;
      pendingStakeAmount.current = null;
      toast.success('Approval confirmed — now staking…');
      refetchAllowance();
      stakeWrite(
        {
          address: STAKING_ADDRESS!,
          abi: stakingAbi,
          functionName: 'stake',
          args: [amount],
        },
        {
          onSuccess: () => { toast.success('Staked!'); setStakeAmount(''); refetchAll(); },
          onError: (err) => toast.error(err.message.slice(0, 100)),
        },
      );
      resetApprove();
    }
  }, [approveConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  const stakedAmount = stakeInfo ? stakeInfo.amount : 0n;
  const isSuperDonor = stakeInfo?.isSuperDonor ?? false;
  const fraudStrikes = stakeInfo?.fraudStrikes ?? 0;
  const locked = (unlockRemaining ?? 0n) > 0n;

  function refetchAll() {
    refetchStake();
    refetchBalance();
    refetchAllowance();
  }

  async function handleStake() {
    if (!stakeAmount.trim()) return;
    const amount = parseEther(stakeAmount);

    // Check if approval is needed
    if ((allowance ?? 0n) < amount) {
      pendingStakeAmount.current = amount;
      approve(
        {
          address: SHARE_TOKEN_ADDRESS!,
          abi: shareTokenAbi,
          functionName: 'approve',
          args: [STAKING_ADDRESS!, amount],
        },
        {
          onError: (err) => { pendingStakeAmount.current = null; toast.error(err.message.slice(0, 100)); },
        },
      );
    } else {
      stakeWrite(
        {
          address: STAKING_ADDRESS!,
          abi: stakingAbi,
          functionName: 'stake',
          args: [amount],
        },
        {
          onSuccess: () => { toast.success('Staked!'); setStakeAmount(''); refetchAll(); },
          onError: (err) => toast.error(err.message.slice(0, 100)),
        },
      );
    }
  }

  async function handleUnstake() {
    if (!unstakeAmount.trim()) return;
    unstakeWrite(
      {
        address: STAKING_ADDRESS!,
        abi: stakingAbi,
        functionName: 'unstake',
        args: [parseEther(unstakeAmount)],
      },
      {
        onSuccess: () => { toast.success('Unstaked!'); setUnstakeAmount(''); refetchAll(); },
        onError: (err) => toast.error(err.message.slice(0, 100)),
      },
    );
  }

  function handleActivateSuperDonor() {
    activateSuper(
      {
        address: STAKING_ADDRESS!,
        abi: stakingAbi,
        functionName: 'activateSuperDonor',
      },
      {
        onSuccess: () => { toast.success('Super Donor activated!'); refetchAll(); },
        onError: (err) => toast.error(err.message.slice(0, 100)),
      },
    );
  }

  const anyPending = approving || staking || unstaking || activatingSuper ||
                     waitingApprove || waitingStake || waitingUnstake || waitingSuper;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-5">
      {/* Status header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Staking</h2>
        <div className={cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
          isSuperDonor
            ? 'bg-amber-100 text-amber-700'
            : stakedAmount >= parseEther('10')
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500',
        )}>
          {isSuperDonor ? (
            <><ShieldCheck className="h-3.5 w-3.5" /> Super Donor</>
          ) : stakedAmount >= parseEther('10') ? (
            <><Shield className="h-3.5 w-3.5" /> Eligible</>
          ) : (
            'Not staked'
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500 mb-0.5">Staked</p>
          <p className="text-lg font-semibold text-gray-900">
            {Number(formatEther(stakedAmount)).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500 mb-0.5">Available</p>
          <p className="text-lg font-semibold text-gray-900">
            {balance !== undefined ? Number(formatEther(balance)).toLocaleString() : '—'}
          </p>
        </div>
      </div>

      {locked && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Super Donor lock: {Math.ceil(Number(unlockRemaining!) / 86400)} days remaining
        </div>
      )}

      {fraudStrikes > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Fraud strikes: {fraudStrikes}/3
        </div>
      )}

      {/* Stake input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Stake $SHARE</label>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="any"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            placeholder="Amount"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
          <button
            onClick={handleStake}
            disabled={!stakeAmount.trim() || anyPending}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {approving || staking || waitingApprove || waitingStake ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Stake'
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400">Min 10 SHARE for withdrawal eligibility · 500 for Super Donor</p>
      </div>

      {/* Unstake input */}
      {stakedAmount > 0n && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Unstake</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="any"
              value={unstakeAmount}
              onChange={(e) => setUnstakeAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            />
            <button
              onClick={handleUnstake}
              disabled={!unstakeAmount.trim() || anyPending || locked}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {unstaking || waitingUnstake ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Unstake'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Super Donor activation */}
      {!isSuperDonor && stakedAmount >= parseEther('500') && (
        <button
          onClick={handleActivateSuperDonor}
          disabled={anyPending}
          className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {activatingSuper || waitingSuper ? (
            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
          ) : (
            'Activate Super Donor (1.5× multiplier)'
          )}
        </button>
      )}
    </div>
  );
}
