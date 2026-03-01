'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { Trophy, BadgeCheck, Medal } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface LeaderboardUser {
  id: string;
  name: string | null;
  profile_pic: string | null;
  karma_points: number;
  is_verified_donor: boolean;
  total_confirmed_donations: number;
}

const RANK_STYLE: Record<number, string> = {
  1: 'bg-yellow-50 border-yellow-300 text-yellow-700',
  2: 'bg-gray-100 border-gray-300 text-gray-600',
  3: 'bg-amber-50 border-amber-300 text-amber-700',
};

const RANK_ICON: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function LeaderboardPage() {
  const { user } = useAuthStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () =>
      api
        .get<{ users: LeaderboardUser[] }>('/users/leaderboard?limit=50')
        .then((r) => r.data.users),
  });

  return (
    <Layout title="Leaderboard">
      <div className="mx-auto max-w-xl space-y-4">

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Trophy className="h-4 w-4 text-primary-600" />
          Top donors ranked by karma points
        </div>

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600">Failed to load leaderboard.</p>
        )}

        {data && (
          <ol className="space-y-2">
            {data.map((u, idx) => {
              const rank      = idx + 1;
              const isCurrentUser = u.id === user?.id;
              const initials  = (u.name ?? 'A').slice(0, 2).toUpperCase();

              return (
                <li key={u.id}>
                  <Link
                    href={`/profile/${u.id}`}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-4 py-3 transition hover:shadow-md',
                      isCurrentUser
                        ? 'border-primary-300 bg-primary-50 ring-1 ring-primary-300'
                        : rank <= 3
                        ? RANK_STYLE[rank]
                        : 'border-gray-200 bg-white'
                    )}
                  >
                    {/* Rank */}
                    <div className="w-8 shrink-0 text-center">
                      {rank <= 3 ? (
                        <span className="text-lg">{RANK_ICON[rank]}</span>
                      ) : (
                        <span className="text-sm font-bold text-gray-400 tabular-nums">
                          {rank}
                        </span>
                      )}
                    </div>

                    {/* Avatar */}
                    {u.profile_pic ? (
                      <Image
                        src={u.profile_pic}
                        alt={u.name ?? 'User'}
                        width={36}
                        height={36}
                        className="rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                        {initials}
                      </div>
                    )}

                    {/* Name */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {u.name ?? 'Anonymous'}
                        </span>
                        {isCurrentUser && (
                          <span className="text-xs text-primary-600 font-semibold">(you)</span>
                        )}
                        {u.is_verified_donor && (
                          <BadgeCheck className="h-3.5 w-3.5 text-primary-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {u.total_confirmed_donations} donation{u.total_confirmed_donations !== 1 ? 's' : ''}
                      </p>
                    </div>

                    {/* Karma */}
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-gray-900 tabular-nums">
                        {u.karma_points.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">karma</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}

        {data?.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
            <Medal className="h-10 w-10" />
            <p className="text-sm">No donors yet — be the first!</p>
          </div>
        )}

      </div>
    </Layout>
  );
}
