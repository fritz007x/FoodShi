'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Loader2, Trophy, Heart, Gift, Medal } from 'lucide-react';
import Layout from '@/components/Layout';
import { usersApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { getInitials, cn } from '@/lib/utils';

type LeaderboardType = 'karma' | 'donations';

export default function LeaderboardPage() {
  const { user } = useAuthStore();
  const [type, setType] = useState<LeaderboardType>('karma');
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, [type]);

  async function loadLeaderboard() {
    setIsLoading(true);
    try {
      const { data } = await usersApi.getLeaderboard({ type, limit: 50 });
      setUsers(data.users);
    } catch (error) {
      toast.error('Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  }

  function getRankBadge(rank: number) {
    if (rank === 1) return <Medal className="h-6 w-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Medal className="h-6 w-6 text-amber-600" />;
    return <span className="w-6 text-center text-gray-500 font-medium">{rank}</span>;
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <Trophy className="h-8 w-8 text-yellow-500" />
        </div>

        {/* Type Selector */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setType('karma')}
            className={cn(
              'flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
              type === 'karma'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <Heart className="h-5 w-5" />
            Top Karma
          </button>
          <button
            onClick={() => setType('donations')}
            className={cn(
              'flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
              type === 'donations'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <Gift className="h-5 w-5" />
            Top Donors
          </button>
        </div>

        {/* Leaderboard */}
        <div className="card">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No users on the leaderboard yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {users.map((u, index) => {
                const rank = index + 1;
                const isCurrentUser = u.id === user?.id;

                return (
                  <Link
                    key={u.id}
                    href={`/profile/${u.id}`}
                    className={cn(
                      'flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors',
                      isCurrentUser && 'bg-primary-50'
                    )}
                  >
                    {/* Rank */}
                    <div className="w-8 flex justify-center">
                      {getRankBadge(rank)}
                    </div>

                    {/* Avatar */}
                    {u.profile_pic ? (
                      <img
                        src={u.profile_pic}
                        alt={u.name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
                        {getInitials(u.name)}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {u.name || 'Anonymous'}
                        </span>
                        {u.is_verified_donor && (
                          <span className="badge-primary text-xs">Verified</span>
                        )}
                        {isCurrentUser && (
                          <span className="badge bg-primary-600 text-white text-xs">You</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {u.donations_count || 0} donations
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {type === 'karma' ? (
                          <>
                            <Heart className="h-4 w-4 text-primary-500" />
                            <span className="font-bold text-primary-700">
                              {u.karma_points}
                            </span>
                          </>
                        ) : (
                          <>
                            <Gift className="h-4 w-4 text-primary-500" />
                            <span className="font-bold text-primary-700">
                              {u.donations_count}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {type === 'karma' ? 'karma' : 'donations'}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
