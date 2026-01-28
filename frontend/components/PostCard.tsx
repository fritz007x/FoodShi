'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Heart, MessageCircle, Share2, MoreHorizontal, Flag, Trash } from 'lucide-react';
import { postsApi, reportsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatRelativeTime, getInitials, cn } from '@/lib/utils';

interface Post {
  id: string;
  content: string;
  image_url?: string;
  likes_count: number;
  created_at: string;
  user_id: string;
  name: string;
  profile_pic?: string;
  is_verified_donor?: boolean;
  is_liked?: boolean;
}

interface PostCardProps {
  post: Post;
  onDelete?: () => void;
}

export default function PostCard({ post, onDelete }: PostCardProps) {
  const { user } = useAuthStore();
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = user?.id === post.user_id;

  async function handleLike() {
    try {
      const { data } = await postsApi.like(post.id);
      setIsLiked(data.liked);
      setLikesCount((prev) => (data.liked ? prev + 1 : prev - 1));
    } catch (error) {
      toast.error('Failed to like post');
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this post?')) return;

    setIsDeleting(true);
    try {
      await postsApi.delete(post.id);
      toast.success('Post deleted');
      onDelete?.();
    } catch (error) {
      toast.error('Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleReport() {
    try {
      await reportsApi.create({
        reportedPostId: post.id,
        reason: 'Inappropriate content',
      });
      toast.success('Post reported');
      setShowMenu(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to report post');
    }
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <Link href={`/profile/${post.user_id}`} className="flex items-center gap-3">
          {post.profile_pic ? (
            <img
              src={post.profile_pic}
              alt={post.name}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
              {getInitials(post.name)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{post.name || 'Anonymous'}</span>
              {post.is_verified_donor && (
                <span className="badge-primary">Verified</span>
              )}
            </div>
            <span className="text-sm text-gray-500">
              {formatRelativeTime(post.created_at)}
            </span>
          </div>
        </Link>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <MoreHorizontal className="h-5 w-5 text-gray-500" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border z-20 py-1 min-w-[150px]">
                {isOwner ? (
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-red-600 hover:bg-red-50"
                  >
                    <Trash className="h-4 w-4" />
                    Delete
                  </button>
                ) : (
                  <button
                    onClick={handleReport}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-700 hover:bg-gray-50"
                  >
                    <Flag className="h-4 w-4" />
                    Report
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <p className="text-gray-800 whitespace-pre-wrap mb-4">{post.content}</p>

      {/* Image */}
      {post.image_url && (
        <img
          src={post.image_url}
          alt="Post image"
          className="rounded-lg w-full max-h-96 object-cover mb-4"
        />
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 pt-4 border-t">
        <button
          onClick={handleLike}
          className={cn(
            'flex items-center gap-2 text-sm font-medium transition-colors',
            isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
          )}
        >
          <Heart className={cn('h-5 w-5', isLiked && 'fill-current')} />
          {likesCount}
        </button>

        <button className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-primary-600">
          <MessageCircle className="h-5 w-5" />
          Comment
        </button>

        <button className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-primary-600">
          <Share2 className="h-5 w-5" />
          Share
        </button>
      </div>
    </div>
  );
}
