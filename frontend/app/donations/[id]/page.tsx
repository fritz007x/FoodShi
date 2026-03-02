'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import {
  MapPin, Loader2, CheckCircle2, AlertTriangle, X, Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { useAuthStore, useGeolocationStore } from '@/lib/store';
import { getSafeImageUrl } from '@/lib/utils';
import api from '@/lib/api';

interface Donation {
  id: string;
  donor_id: string;
  donor_name: string;
  description: string;
  photo_url: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'disputed';
  challenge_deadline: string;
  confirmed_at: string | null;
  created_at: string;
  points_awarded: number | null;
}

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  disputed:  'bg-red-100 text-red-700',
};

export default function DonationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router       = useRouter();
  const qc           = useQueryClient();
  const { user }     = useAuthStore();
  const { position, loading: gpsLoading, requestFreshLocation } = useGeolocationStore();

  // Whether we're waiting for a fresh GPS fix before firing confirm
  const [awaitingGps, setAwaitingGps] = useState(false);

  const { data: donation, isLoading, error } = useQuery({
    queryKey: ['donation', id],
    queryFn: () =>
      api.get<{ donation: Donation }>(`/donations/${id}`).then((r) => r.data.donation),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const confirmMut = useMutation({
    mutationFn: (pos: { lat: number; lng: number }) =>
      api
        .post<{ donation: Donation }>(`/donations/${id}/confirm`, {
          latitude:  pos.lat,
          longitude: pos.lng,
        })
        .then((r) => r.data.donation),
    onSuccess: (updated) => {
      qc.setQueryData(['donation', id], updated);
      qc.invalidateQueries({ queryKey: ['donations'] });
      toast.success('Pickup confirmed! Karma points awarded.');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Confirmation failed';
      toast.error(msg);
    },
  });

  const disputeMut = useMutation({
    mutationFn: () =>
      api
        .post<{ donation: Donation }>(`/donations/${id}/dispute`)
        .then((r) => r.data.donation),
    onSuccess: (updated) => {
      qc.setQueryData(['donation', id], updated);
      toast('Donation flagged as disputed.', { icon: '⚠️' });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to dispute';
      toast.error(msg);
    },
  });

  const cancelMut = useMutation({
    mutationFn: () =>
      api
        .post<{ donation: Donation }>(`/donations/${id}/cancel`)
        .then((r) => r.data.donation),
    onSuccess: () => {
      toast.success('Donation cancelled.');
      router.replace('/donations');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to cancel';
      toast.error(msg);
    },
  });

  // ── GPS-gated confirm ──────────────────────────────────────────────────────
  // Always requests a FRESH position (maximumAge: 0) so a cached fix from a
  // different location cannot satisfy the proximity check. The idempotency
  // guard prevents double-fire if the user taps the button repeatedly while
  // GPS is resolving.

  function handleConfirm() {
    if (confirmMut.isPending || awaitingGps) return; // idempotency guard
    setAwaitingGps(true);
    requestFreshLocation();
    toast('Getting your location…', { icon: '📍' });
  }

  // Fire confirm once a fresh GPS fix arrives
  useEffect(() => {
    if (awaitingGps && position && !confirmMut.isPending) {
      setAwaitingGps(false);
      confirmMut.mutate(position);
    }
  }, [awaitingGps, position, confirmMut]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Layout title="Donation">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
      </Layout>
    );
  }

  if (error || !donation) {
    return (
      <Layout title="Donation">
        <p className="text-sm text-red-600">Donation not found.</p>
      </Layout>
    );
  }

  const isDonor    = user?.id === donation.donor_id;
  const isPending  = donation.status === 'pending';
  const mutBusy    = confirmMut.isPending || disputeMut.isPending || cancelMut.isPending;

  return (
    <Layout title="Donation detail">
      <div className="mx-auto max-w-lg space-y-5">

        {/* Photo — only render HTTPS URLs to prevent IP leaks */}
        {getSafeImageUrl(donation.photo_url) && (
          <img
            src={getSafeImageUrl(donation.photo_url)!}
            alt="donation"
            className="w-full rounded-xl object-cover max-h-64"
            referrerPolicy="no-referrer"
          />
        )}

        {/* Main card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">

          {/* Status + title */}
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-gray-900 leading-relaxed">{donation.description}</p>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[donation.status]}`}
            >
              {donation.status}
            </span>
          </div>

          {/* Meta */}
          <dl className="grid grid-cols-2 gap-3 text-xs text-gray-500">
            <div>
              <dt className="font-medium text-gray-700">Donor</dt>
              <dd>{donation.donor_name ?? 'Anonymous'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-700">Listed</dt>
              <dd>{formatDistanceToNow(new Date(donation.created_at), { addSuffix: true })}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-700">Expires</dt>
              <dd>{format(new Date(donation.challenge_deadline), 'MMM d, HH:mm')}</dd>
            </div>
            {donation.confirmed_at && (
              <div>
                <dt className="font-medium text-gray-700">Confirmed</dt>
                <dd>{formatDistanceToNow(new Date(donation.confirmed_at), { addSuffix: true })}</dd>
              </div>
            )}
          </dl>

          {/* GPS note */}
          {isPending && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              Pickup confirmation requires GPS — you must be within 5 km of this donation.
            </div>
          )}
        </div>

        {/* Actions */}
        {isPending && (
          <div className="flex flex-col gap-2">
            {/* Receiver confirms pickup */}
            {!isDonor && (
              <button
                onClick={handleConfirm}
                disabled={mutBusy || awaitingGps || gpsLoading}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {(confirmMut.isPending || awaitingGps || gpsLoading) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {awaitingGps || gpsLoading ? 'Getting location…' : 'Confirm pickup'}
              </button>
            )}

            {/* Anyone except donor can dispute */}
            {!isDonor && (
              <button
                onClick={() => disputeMut.mutate()}
                disabled={mutBusy}
                className="flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <AlertTriangle className="h-4 w-4" />
                Flag as dispute
              </button>
            )}

            {/* Donor can cancel */}
            {isDonor && (
              <button
                onClick={() => cancelMut.mutate()}
                disabled={mutBusy}
                className="flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {cancelMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                Cancel donation
              </button>
            )}
          </div>
        )}

        {/* Confirmed banner */}
        {donation.status === 'confirmed' && (
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div className="text-sm text-green-800">
              <p className="font-semibold">Pickup confirmed!</p>
              {donation.points_awarded && (
                <p className="text-xs mt-0.5">{donation.points_awarded} karma points awarded to donor.</p>
              )}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
