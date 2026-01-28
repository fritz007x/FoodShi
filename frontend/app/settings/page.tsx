'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2, User, Mail, FileText, Image, LogOut, Trash2, Send } from 'lucide-react';
import Layout from '@/components/Layout';
import { usersApi, invitationsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { getInitials } from '@/lib/utils';

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [form, setForm] = useState({
    name: user?.name || '',
    bio: user?.bio || '',
    profilePic: user?.profilePic || '',
  });

  async function handleSave() {
    setIsSaving(true);
    try {
      const { data } = await usersApi.updateProfile(form);
      setUser({ ...user!, ...data.user });
      toast.success('Profile updated');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;

    setIsSendingInvite(true);
    try {
      const { data } = await invitationsApi.send({ email: inviteEmail });
      toast.success(`Invitation sent! Code: ${data.invitation.invite_code}`);
      setInviteEmail('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send invitation');
    } finally {
      setIsSendingInvite(false);
    }
  }

  function handleLogout() {
    logout();
    router.push('/');
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        {/* Profile Settings */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Profile</h2>

          <div className="space-y-4">
            {/* Avatar Preview */}
            <div className="flex items-center gap-4">
              {form.profilePic ? (
                <img
                  src={form.profilePic}
                  alt="Avatar"
                  className="h-16 w-16 rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xl">
                  {getInitials(form.name || user?.email)}
                </div>
              )}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Profile Picture URL
                </label>
                <input
                  type="url"
                  value={form.profilePic}
                  onChange={(e) => setForm({ ...form, profilePic: e.target.value })}
                  placeholder="https://..."
                  className="input"
                />
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="h-4 w-4 inline mr-1" />
                Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your name"
                className="input"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Mail className="h-4 w-4 inline mr-1" />
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="input bg-gray-50"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FileText className="h-4 w-4 inline mr-1" />
                Bio
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Tell us about yourself..."
                className="input resize-none min-h-[100px]"
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">{form.bio.length}/500</p>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary"
            >
              {isSaving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>

        {/* Invite Friends */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Invite Friends</h2>
          <p className="text-sm text-gray-600 mb-4">
            Invite friends and earn 50 bonus Karma when they join!
          </p>

          <form onSubmit={handleSendInvite} className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="friend@example.com"
              className="input flex-1"
              required
            />
            <button
              type="submit"
              disabled={isSendingInvite}
              className="btn-primary"
            >
              {isSendingInvite ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Send
                </>
              )}
            </button>
          </form>
        </div>

        {/* Account Actions */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Account</h2>

          <div className="space-y-3">
            <button
              onClick={handleLogout}
              className="btn-secondary w-full justify-start text-gray-700"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Log Out
            </button>

            <button
              className="btn-ghost w-full justify-start text-red-600 hover:bg-red-50"
              onClick={() => toast.error('Account deletion coming soon')}
            >
              <Trash2 className="h-5 w-5 mr-2" />
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
