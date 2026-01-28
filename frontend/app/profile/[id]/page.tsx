'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2, MapPin, Calendar, Heart, Gift, Trophy, Edit } from 'lucide-react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import PostCard from '@/components/PostCard';
import { usersApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatDate, getInitials, cn, MEDAL_COLORS } from '@/lib/utils';

export default function ProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const { user: currentUser } = useAuthStore();

  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'donations'>('posts');
  const [isLoading, setIsLoading] = useState(true);

  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    loadProfile();
  }, [userId]);

  async function loadProfile() {
    setIsLoading(true);
    try {
      const [profileRes, postsRes] = await Promise.all([
        usersApi.getProfile(userId),
        usersApi.getUserPosts(userId, { limit: 20 }),
      ]);

      setProfile(profileRes.data.user);
      setPosts(postsRes.data.posts);
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Profile not found</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Profile Header */}
        <div className="card mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {profile.profile_pic ? (
              <img
                src={profile.profile_pic}
                alt={profile.name}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-3xl">
                {getInitials(profile.name)}
              </div>
            )}

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold">{profile.name || 'Anonymous'}</h1>
                {profile.is_verified_donor && (
                  <span className="badge-primary">Verified Donor</span>
                )}
              </div>

              {profile.bio && (
                <p className="text-gray-600 mb-3">{profile.bio}</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {formatDate(profile.created_at)}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="h-4 w-4 text-primary-500" />
                  {profile.karma_points} Karma
                </span>
                <span className="flex items-center gap-1">
                  <Gift className="h-4 w-4" />
                  {profile.donations_given || 0} donations
                </span>
              </div>
            </div>

            {isOwnProfile && (
              <Link href="/settings" className="btn-secondary">
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Link>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {profile.donations_given || 0}
              </div>
              <div className="text-sm text-gray-500">Donations Given</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {profile.donations_received || 0}
              </div>
              <div className="text-sm text-gray-500">Received</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {profile.posts_count || 0}
              </div>
              <div className="text-sm text-gray-500">Posts</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('posts')}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              activeTab === 'posts'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            Posts
          </button>
          <button
            onClick={() => setActiveTab('donations')}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              activeTab === 'donations'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            Donations
          </button>
        </div>

        {/* Content */}
        {activeTab === 'posts' ? (
          posts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No posts yet
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Gift className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Donation history coming soon</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
