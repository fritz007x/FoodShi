'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { VerificationGate } from '@/components/VerificationGate';
import { useGeolocationStore } from '@/lib/store';
import api from '@/lib/api';

export default function DonatePage() {
  const router = useRouter();
  const { position, loading: gpsLoading, error: gpsError, requestLocation } = useGeolocationStore();

  const [description, setDescription] = useState('');
  const [photoUrl,    setPhotoUrl]    = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!position) {
      requestLocation();
      toast.error('Location required — allow GPS access and try again');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post<{ donation: { id: string } }>('/donations', {
        latitude:    position.lat,
        longitude:   position.lng,
        description,
        ...(photoUrl.trim() ? { photoUrl: photoUrl.trim() } : {}),
      });
      toast.success('Donation listed!');
      router.push(`/donations/${data.donation.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to create donation';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout title="Donate Food">
      <div className="mx-auto max-w-lg space-y-6">

        <VerificationGate>

        {/* Location card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Your location</h2>

          {position ? (
            <div className="flex items-center gap-2 text-sm text-primary-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={requestLocation}
              disabled={gpsLoading}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {gpsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4 text-primary-600" />
              )}
              {gpsLoading ? 'Getting location…' : 'Enable GPS'}
            </button>
          )}

          {gpsError && !position && (
            <p className="mt-2 text-xs text-red-600">{gpsError}</p>
          )}
        </div>

        {/* Donation form */}
        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">What are you donating?</h2>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400 font-normal">(max 1000 chars)</span>
            </label>
            <textarea
              id="description"
              required
              rows={4}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none resize-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              placeholder="e.g. 2 kg of rice, unopened bag — expires next month"
            />
            <p className="mt-1 text-right text-xs text-gray-400">{description.length}/1000</p>
          </div>

          <div>
            <label htmlFor="photoUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Photo URL <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="photoUrl"
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              placeholder="https://…"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !position}
            className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 active:bg-primary-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Listing…' : 'List donation'}
          </button>

          {!position && (
            <p className="text-center text-xs text-gray-400">Enable GPS above before listing</p>
          )}
        </form>

        </VerificationGate>

      </div>
    </Layout>
  );
}
