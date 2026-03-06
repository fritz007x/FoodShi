'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Star, ArrowRightLeft, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { VerificationGate } from '@/components/VerificationGate';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface KarmaData {
  karmaPoints: number;
  pendingEmissionPoints: number;
  history: KarmaEntry[];
}

interface KarmaEntry {
  id: string;
  points: number;
  reason: string;
  description: string | null;
  created_at: string;
}

interface MedalTier {
  name: string;
  minDays: number;
  minDonations: number;
  burnCostShare: number;
  earnedAt: string | null;
  eligible: boolean;
  progress: {
    days:      { current: number; required: number };
    donations: { current: number; required: number };
  };
}

interface MedalData {
  totalConfirmedDonations: number;
  tiers: MedalTier[];
}

interface ExchangeResponse {
  exchangeRequest: { id: string; karma_amount: number; token_amount: number };
  instruction: string;
}

// ── Medal visual config ────────────────────────────────────────────────────────

const MEDAL_STYLE: Record<string, { emoji: string; ring: string; bg: string; text: string }> = {
  Bronze:   { emoji: '🥉', ring: 'ring-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700'  },
  Silver:   { emoji: '🥈', ring: 'ring-gray-400',   bg: 'bg-gray-50',   text: 'text-gray-600'   },
  Gold:     { emoji: '🥇', ring: 'ring-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  Platinum: { emoji: '💎', ring: 'ring-purple-400', bg: 'bg-purple-50', text: 'text-purple-700' },
};

const REASON_LABEL: Record<string, string> = {
  donation_given:    'Donation given',
  donation_received: 'Donation received',
  exchange:          'Karma exchanged',
  bonus:             'Bonus',
};

// ── Progress bar ───────────────────────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-200">
      <div
        className="h-1.5 rounded-full bg-primary-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function RewardsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const [karmaInput, setKarmaInput] = useState('');
  const [lastInstruction, setLastInstruction] = useState<string | null>(null);

  // Queries
  const karmaQuery = useQuery({
    queryKey: ['rewards', 'karma'],
    queryFn: () => api.get<KarmaData>('/rewards/karma').then((r) => r.data),
  });

  const medalQuery = useQuery({
    queryKey: ['rewards', 'medals'],
    queryFn: () => api.get<MedalData>('/rewards/medals').then((r) => r.data),
  });

  // Exchange mutation
  const exchangeMut = useMutation({
    mutationFn: (karmaAmount: number) =>
      api
        .post<ExchangeResponse>('/rewards/exchange', { karmaAmount })
        .then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`Exchange initiated — ${data.exchangeRequest.token_amount} $SHARE queued`);
      setLastInstruction(data.instruction);
      setKarmaInput('');
      qc.invalidateQueries({ queryKey: ['rewards', 'karma'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Exchange failed';
      toast.error(msg);
    },
  });

  // Derived
  const karma    = karmaQuery.data;
  const medals   = medalQuery.data;
  const amount   = parseInt(karmaInput, 10);
  const validAmt = !isNaN(amount) && amount >= 100 && amount % 10 === 0;
  const shareOut = validAmt ? amount / 10 : 0;
  const enoughKarma = validAmt && (karma?.karmaPoints ?? 0) >= amount;

  function handleExchange(e: React.FormEvent) {
    e.preventDefault();
    if (!validAmt || !enoughKarma) return;
    exchangeMut.mutate(amount);
  }

  return (
    <Layout title="Rewards">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* ── Karma balance ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="Karma balance"
            value={karma?.karmaPoints ?? '—'}
            loading={karmaQuery.isLoading}
            accent
          />
          <StatCard
            label="Pending emission"
            value={karma?.pendingEmissionPoints ?? '—'}
            loading={karmaQuery.isLoading}
            note="credited tonight"
          />
          <StatCard
            label="Exchange rate"
            value="10 : 1"
            note="karma per $SHARE"
            className="col-span-2 sm:col-span-1"
          />
        </div>

        {/* ── Exchange form ── */}
        <VerificationGate>
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary-600" />
            <h2 className="text-sm font-semibold text-gray-900">Exchange karma for $SHARE</h2>
          </div>

          {!user?.walletAddress && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>You must connect and link a wallet before exchanging. Go to the Wallet page.</span>
            </div>
          )}

          <form onSubmit={handleExchange} className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label htmlFor="karma-amount" className="sr-only">Karma amount</label>
                <input
                  id="karma-amount"
                  type="number"
                  min={100}
                  step={10}
                  value={karmaInput}
                  onChange={(e) => setKarmaInput(e.target.value)}
                  placeholder="Min 100 karma"
                  disabled={!user?.walletAddress || exchangeMut.isPending}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-4 text-sm text-gray-600 min-w-[110px]">
                = {shareOut > 0 ? shareOut.toLocaleString() : '—'} $SHARE
              </div>
            </div>

            {validAmt && !enoughKarma && (
              <p className="text-xs text-red-600">Insufficient karma (balance: {karma?.karmaPoints ?? 0})</p>
            )}

            <button
              type="submit"
              disabled={!validAmt || !enoughKarma || exchangeMut.isPending || !user?.walletAddress}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {exchangeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
              {exchangeMut.isPending ? 'Exchanging…' : 'Exchange karma'}
            </button>
          </form>

          {lastInstruction && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-700">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <p className="break-all">{lastInstruction}</p>
            </div>
          )}
        </section>
        </VerificationGate>

        {/* ── Medal tiers ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Star className="h-4 w-4 text-primary-600" />
            Medal tiers
          </h2>

          {medalQuery.isLoading && (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-xl bg-gray-200" />
              ))}
            </div>
          )}

          {medals && (
            <div className="grid gap-3 sm:grid-cols-2">
              {medals.tiers.map((tier) => {
                const style = MEDAL_STYLE[tier.name];
                return (
                  <div
                    key={tier.name}
                    className={cn(
                      'rounded-xl border p-4 space-y-3',
                      tier.eligible
                        ? `ring-2 ${style.ring} ${style.bg} border-transparent`
                        : 'bg-white border-gray-200'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{style.emoji}</span>
                        <span className={cn('text-sm font-semibold', tier.eligible ? style.text : 'text-gray-900')}>
                          {tier.name}
                        </span>
                      </div>
                      {tier.earnedAt ? (
                        <span className="text-xs text-green-600 font-medium">Minted</span>
                      ) : tier.eligible ? (
                        <span className={cn('text-xs font-medium', style.text)}>Eligible!</span>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      {/* Days progress */}
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Days active</span>
                          <span>{tier.progress.days.current}/{tier.progress.days.required}</span>
                        </div>
                        <ProgressBar
                          value={tier.progress.days.current}
                          max={tier.progress.days.required}
                        />
                      </div>
                      {/* Donations progress */}
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Donations</span>
                          <span>{tier.progress.donations.current}/{tier.progress.donations.required}</span>
                        </div>
                        <ProgressBar
                          value={tier.progress.donations.current}
                          max={tier.progress.donations.required}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-gray-400">
                      Mint cost: {tier.burnCostShare} $SHARE burned on-chain
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Karma history ── */}
        {karma && karma.history.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Recent karma history</h2>
            </div>
            <ul className="divide-y divide-gray-100">
              {karma.history.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm text-gray-800">
                      {REASON_LABEL[entry.reason] ?? entry.reason}
                    </p>
                    {entry.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{entry.description}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      entry.points >= 0 ? 'text-primary-600' : 'text-red-500'
                    )}
                  >
                    {entry.points >= 0 ? '+' : ''}{entry.points}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

      </div>
    </Layout>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  note,
  accent,
  loading,
  className,
}: {
  label: string;
  value: string | number;
  note?: string;
  accent?: boolean;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 shadow-sm',
        accent ? 'bg-primary-600 border-primary-700 text-white' : 'bg-white border-gray-200',
        className
      )}
    >
      <p className={cn('text-xs font-medium mb-1', accent ? 'text-primary-100' : 'text-gray-500')}>
        {label}
      </p>
      {loading ? (
        <div className="h-7 w-20 animate-pulse rounded bg-gray-200" />
      ) : (
        <p className={cn('text-2xl font-bold tabular-nums', accent ? 'text-white' : 'text-gray-900')}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      )}
      {note && (
        <p className={cn('text-xs mt-1', accent ? 'text-primary-200' : 'text-gray-400')}>{note}</p>
      )}
    </div>
  );
}
