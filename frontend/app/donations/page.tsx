'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import DonationCard from '@/components/DonationCard';
import { donationsApi } from '@/lib/api';
import { useAuthStore, useGeolocationStore } from '@/lib/store';
import { cn } from '@/lib/utils';

type TabType = 'all' | 'given' | 'received';

export default function DonationsPage() {
  const { user } = useAuthStore();
  const { latitude, longitude, requestLocation } = useGeolocationStore();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [donations, setDonations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    loadDonations();
  }, [activeTab]);

  async function loadDonations() {
    setIsLoading(true);
    try {
      const { data } = await donationsApi.getAll({ limit: 50 });
      let filtered = data.donations;

      if (activeTab === 'given') {
        filtered = filtered.filter((d: any) => d.donor_id === user?.id);
      } else if (activeTab === 'received') {
        filtered = filtered.filter((d: any) => d.receiver_id === user?.id);
      }

      setDonations(filtered);
    } catch (error) {
      toast.error('Failed to load donations');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm(donationId: string) {
    if (!latitude || !longitude) {
      await requestLocation();
      if (!latitude || !longitude) {
        toast.error('Location is required to confirm donation');
        return;
      }
    }

    setConfirmingId(donationId);
    try {
      const { data } = await donationsApi.confirm(donationId, { latitude, longitude });
      toast.success(`Donation confirmed! Distance: ${data.distance}m`);
      loadDonations();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to confirm donation');
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleDispute(donationId: string) {
    const reason = prompt('Please provide a reason for the dispute:');
    if (!reason) return;

    try {
      await donationsApi.dispute(donationId, { reason });
      toast.success('Donation disputed');
      loadDonations();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to dispute donation');
    }
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'all', label: 'All Donations' },
    { key: 'given', label: 'My Donations' },
    { key: 'received', label: 'Received' },
  ];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Donations</h1>
          <Link href="/donate" className="btn-primary">
            <Plus className="h-4 w-4 mr-1" />
            New Donation
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Donations List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : donations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No donations found</p>
            <Link href="/donate" className="btn-primary">
              Create your first donation
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {donations.map((donation) => (
              <DonationCard
                key={donation.id}
                donation={donation}
                showActions={
                  donation.status === 'pending' &&
                  donation.donor_id !== user?.id
                }
                onConfirm={() => handleConfirm(donation.id)}
                onDispute={() => handleDispute(donation.id)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
