'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { MapPin, Camera, Loader2, AlertCircle } from 'lucide-react';
import Layout from '@/components/Layout';
import { donationsApi } from '@/lib/api';
import { useGeolocationStore } from '@/lib/store';

export default function DonatePage() {
  const router = useRouter();
  const { latitude, longitude, error: geoError, isLoading: geoLoading, requestLocation } = useGeolocationStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    description: '',
    photoUrl: '',
  });

  useEffect(() => {
    requestLocation();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!latitude || !longitude) {
      toast.error('Location is required');
      return;
    }

    if (form.description.length < 10) {
      toast.error('Please provide a more detailed description');
      return;
    }

    setIsSubmitting(true);
    try {
      await donationsApi.create({
        latitude,
        longitude,
        description: form.description,
        photoUrl: form.photoUrl || undefined,
      });

      toast.success('Donation created! Points will be confirmed after 3 days.');
      router.push('/donations');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create donation');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Create Donation</h1>
        <p className="text-gray-600 mb-6">
          Share your food donation and earn Karma Points
        </p>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <MapPin className="h-5 w-5 text-gray-500" />
                {geoLoading ? (
                  <span className="text-gray-500">Getting location...</span>
                ) : geoError ? (
                  <div className="flex-1">
                    <span className="text-red-600">{geoError}</span>
                    <button
                      type="button"
                      onClick={requestLocation}
                      className="ml-2 text-primary-600 underline"
                    >
                      Retry
                    </button>
                  </div>
                ) : latitude && longitude ? (
                  <span className="text-gray-700">
                    {latitude.toFixed(6)}, {longitude.toFixed(6)}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={requestLocation}
                    className="text-primary-600 underline"
                  >
                    Enable location
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Location is required for GPS verification
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the food you're donating (type, quantity, freshness, etc.)"
                className="input resize-none min-h-[120px]"
                required
                minLength={10}
                maxLength={1000}
              />
              <p className="text-xs text-gray-500 mt-1">
                {form.description.length}/1000 characters
              </p>
            </div>

            {/* Photo URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Photo URL (optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={form.photoUrl}
                  onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                  placeholder="https://..."
                  className="input flex-1"
                />
                <button type="button" className="btn-secondary">
                  <Camera className="h-5 w-5" />
                </button>
              </div>
              {form.photoUrl && (
                <img
                  src={form.photoUrl}
                  alt="Preview"
                  className="mt-3 rounded-lg max-h-48 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">How it works:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li>Points enter "Pending" status for 3 days</li>
                    <li>Receivers must be within 100m to confirm</li>
                    <li>If no dispute, points are confirmed automatically</li>
                    <li>You'll earn +10 Karma Points per donation</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !latitude || !longitude}
              className="btn-primary w-full"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Create Donation'
              )}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
