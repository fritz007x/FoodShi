'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';

interface MeUser {
  id: string;
  name: string | null;
  bio: string | null;
  profile_pic: string | null;
  wallet_address: string | null;
  karma_points: number;
  email: string;
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const { updateUser } = useAuthStore();

  // Fetch own full profile for initial form values
  const { data: me } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => api.get<{ user: MeUser }>('/users/me').then((r) => r.data.user),
  });

  const [name,       setName]       = useState('');
  const [bio,        setBio]        = useState('');
  const [profilePic, setProfilePic] = useState('');

  // Populate once data arrives (only if fields are still empty)
  const [seeded, setSeeded] = useState(false);
  if (me && !seeded) {
    setName(me.name ?? '');
    setBio(me.bio ?? '');
    setProfilePic(me.profile_pic ?? '');
    setSeeded(true);
  }

  const updateMut = useMutation({
    mutationFn: (body: Record<string, string>) =>
      api.patch<{ user: MeUser }>('/users/me', body).then((r) => r.data.user),
    onSuccess: (updated) => {
      // Keep auth store in sync so Sidebar shows updated username
      updateUser({
        username:  updated.name ?? '',
        avatarUrl: updated.profile_pic ?? null,
      });
      qc.setQueryData(['users', 'me'], (old: { user: MeUser } | undefined) =>
        old ? { user: { ...old.user, ...updated } } : old
      );
      qc.invalidateQueries({ queryKey: ['user'] });
      toast.success('Profile updated');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Update failed';
      toast.error(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, string> = {};
    if (name.trim())       body.name       = name.trim();
    if (bio.trim())        body.bio        = bio.trim();
    if (profilePic.trim()) body.profilePic = profilePic.trim();

    if (Object.keys(body).length === 0) {
      toast('Nothing changed', { icon: 'ℹ️' });
      return;
    }
    updateMut.mutate(body);
  }

  const wallet = me?.wallet_address;

  return (
    <Layout title="Settings">
      <div className="mx-auto max-w-lg space-y-6">

        {/* Profile form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4"
        >
          <h2 className="text-sm font-semibold text-gray-900">Edit profile</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              placeholder="Your display name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea
              rows={3}
              maxLength={500}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              placeholder="Tell the community a bit about yourself…"
            />
            <p className="mt-1 text-right text-xs text-gray-400">{bio.length}/500</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Profile picture URL
            </label>
            <input
              type="url"
              value={profilePic}
              onChange={(e) => setProfilePic(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              placeholder="https://…"
            />
          </div>

          <button
            type="submit"
            disabled={updateMut.isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {updateMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </form>

        {/* Wallet */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary-600" />
            <h2 className="text-sm font-semibold text-gray-900">Wallet connection</h2>
          </div>

          {wallet ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Linked address</p>
              <p className="font-mono text-sm text-gray-900 break-all">{wallet}</p>
              <p className="text-xs text-gray-400">
                Connect a different wallet below to update your linked address.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No wallet linked. Connect one to exchange karma for $SHARE tokens.
            </p>
          )}

          <ConnectWalletButton />
        </div>

      </div>
    </Layout>
  );
}
