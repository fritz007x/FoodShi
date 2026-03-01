'use client';

import { use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { BadgeCheck, Leaf, Package, Star, Settings } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';

interface PublicUser {
  id: string;
  name: string | null;
  bio: string | null;
  profile_pic: string | null;
  karma_points: number;
  is_verified_donor: boolean;
  created_at: string;
  total_confirmed_donations: number | null;
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id }   = use(params);
  const { user } = useAuthStore();
  const isOwn    = user?.id === id;

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['user', id],
    queryFn: () =>
      api.get<{ user: PublicUser }>(`/users/${id}`).then((r) => r.data.user),
  });

  if (isLoading) {
    return (
      <Layout title="Profile">
        <div className="mx-auto max-w-lg space-y-4">
          <div className="h-36 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-24 animate-pulse rounded-xl bg-gray-200" />
        </div>
      </Layout>
    );
  }

  if (error || !profile) {
    return (
      <Layout title="Profile">
        <p className="text-sm text-red-600">User not found.</p>
      </Layout>
    );
  }

  const displayName = profile.name ?? 'Anonymous';
  const initials    = displayName.slice(0, 2).toUpperCase();
  const donations   = profile.total_confirmed_donations ?? 0;

  return (
    <Layout title={displayName}>
      <div className="mx-auto max-w-lg space-y-4">

        {/* Header card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            {profile.profile_pic ? (
              <Image
                src={profile.profile_pic}
                alt={displayName}
                width={64}
                height={64}
                className="rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700">
                {initials}
              </div>
            )}

            {/* Name + badges */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold text-gray-900 truncate">{displayName}</h1>
                {profile.is_verified_donor && (
                  <span
                    title="Verified donor"
                    className="flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700"
                  >
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified
                  </span>
                )}
              </div>

              <p className="mt-0.5 text-xs text-gray-400">
                Member since {format(new Date(profile.created_at), 'MMMM yyyy')}
              </p>

              {profile.bio && (
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{profile.bio}</p>
              )}
            </div>

            {/* Settings link for own profile */}
            {isOwn && (
              <Link
                href="/settings"
                className="shrink-0 rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                title="Edit profile"
              >
                <Settings className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Star className="h-5 w-5 text-primary-500" />}
            label="Karma points"
            value={profile.karma_points.toLocaleString()}
          />
          <StatCard
            icon={<Package className="h-5 w-5 text-primary-500" />}
            label="Donations confirmed"
            value={donations.toLocaleString()}
          />
        </div>

        {/* Karma tier badge */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Leaf className="h-4 w-4 text-primary-600" />
            <span className="text-sm font-medium text-gray-900">Karma tier</span>
          </div>
          <KarmaTierBadge karma={profile.karma_points} />
        </div>

      </div>
    </Layout>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function KarmaTierBadge({ karma }: { karma: number }) {
  const tiers = [
    { min: 5000, label: 'Legendary',    color: 'text-purple-700 bg-purple-50' },
    { min: 1000, label: 'Super Donor',  color: 'text-yellow-700 bg-yellow-50' },
    { min: 500,  label: 'Committed',    color: 'text-primary-700 bg-primary-50' },
    { min: 100,  label: 'Active',       color: 'text-blue-700 bg-blue-50' },
    { min: 0,    label: 'Getting started', color: 'text-gray-600 bg-gray-100' },
  ];

  const tier = tiers.find((t) => karma >= t.min)!;

  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${tier.color}`}>
      {tier.label} · {karma.toLocaleString()} karma
    </span>
  );
}
