'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { MapPin, Package, Plus } from 'lucide-react';
import { Layout } from '@/components/Layout';
import api from '@/lib/api';

interface Donation {
  id: string;
  donor_id: string;
  donor_name: string;
  description: string;
  photo_url: string | null;
  status: string;
  challenge_deadline: string;
  created_at: string;
}

export default function DonationsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['donations', 'pending'],
    queryFn: () =>
      api.get<{ donations: Donation[] }>('/donations?status=pending').then((r) => r.data.donations),
  });

  return (
    <Layout
      title="Donations"
      actions={
        <Link
          href="/donate"
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 transition"
        >
          <Plus className="h-4 w-4" />
          Donate
        </Link>
      }
    >
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">Failed to load donations.</p>
      )}

      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
          <Package className="h-10 w-10" />
          <p className="text-sm">No pending donations right now.</p>
          <Link href="/donate" className="text-sm font-medium text-primary-600 hover:underline">
            Be the first to donate →
          </Link>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((d) => (
            <Link
              key={d.id}
              href={`/donations/${d.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-primary-300 hover:shadow-md transition"
            >
              <div className="flex items-start gap-3">
                {d.photo_url ? (
                  <img
                    src={d.photo_url}
                    alt="donation"
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                    <Package className="h-7 w-7 text-primary-400" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{d.description}</p>
                  <p className="mt-0.5 text-xs text-gray-500">by {d.donor_name ?? 'Anonymous'}</p>

                  <div className="mt-2 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <MapPin className="h-3 w-3" />
                      GPS confirmed
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                    </span>
                    <span className="ml-auto text-xs text-amber-600 font-medium">
                      Expires {formatDistanceToNow(new Date(d.challenge_deadline), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
