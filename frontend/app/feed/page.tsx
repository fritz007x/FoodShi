'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Heart, Trash2, Loader2, Camera, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { ImageUpload } from '@/components/ImageUpload';
import { useAuthStore } from '@/lib/store';
import { cn, getSafeImageUrl } from '@/lib/utils';
import api from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  likes_count: number;
  liked_by_me: boolean;
  created_at: string;
  author_id: string;
  author_name: string | null;
  author_pic: string | null;
}

const PAGE_SIZE = 20;

// ── Feed page ──────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const qc       = useQueryClient();
  const { user } = useAuthStore();

  const [content,  setContent]  = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [posting,  setPosting]  = useState(false);
  const [showImg,  setShowImg]  = useState(false);

  // Infinite query for the feed
  const feedQuery = useInfiniteQuery({
    queryKey: ['posts'],
    queryFn: ({ pageParam }) =>
      api
        .get<{ posts: Post[] }>(`/posts?limit=${PAGE_SIZE}&offset=${pageParam}`)
        .then((r) => r.data.posts),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
  });

  const allPosts = feedQuery.data?.pages.flat() ?? [];

  // ── Create post ──────────────────────────────────────────────────────────────

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    try {
      const { data } = await api.post<{ post: Post }>('/posts', {
        content: content.trim(),
        ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
      });
      // Prepend to first page cache
      qc.setQueryData(['posts'], (old: typeof feedQuery.data) => {
        if (!old) return old;
        const [first, ...rest] = old.pages;
        return { ...old, pages: [[data.post, ...first], ...rest] };
      });
      setContent('');
      setImageUrl('');
      setShowImg(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to post';
      toast.error(msg);
    } finally {
      setPosting(false);
    }
  }

  // ── Like toggle ──────────────────────────────────────────────────────────────

  const likeMut = useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) =>
      liked
        ? api.delete(`/posts/${id}/like`)
        : api.post(`/posts/${id}/like`),
    onMutate: async ({ id, liked }) => {
      // Optimistic update
      qc.setQueryData(['posts'], (old: typeof feedQuery.data) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((p) =>
              p.id === id
                ? { ...p, liked_by_me: !liked, likes_count: p.likes_count + (liked ? -1 : 1) }
                : p
            )
          ),
        };
      });
    },
    onError: (_err, { id, liked }) => {
      // Revert
      qc.setQueryData(['posts'], (old: typeof feedQuery.data) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((p) =>
              p.id === id
                ? { ...p, liked_by_me: liked, likes_count: p.likes_count + (liked ? 1 : -1) }
                : p
            )
          ),
        };
      });
      toast.error('Failed to update like');
    },
  });

  // ── Delete post ──────────────────────────────────────────────────────────────

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/posts/${id}`),
    onSuccess: (_data, id) => {
      qc.setQueryData(['posts'], (old: typeof feedQuery.data) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => page.filter((p) => p.id !== id)),
        };
      });
      toast.success('Post deleted');
    },
    onError: () => toast.error('Failed to delete post'),
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Layout title="Feed">
      <div className="mx-auto max-w-xl space-y-4">

        {/* Compose */}
        <form
          onSubmit={handlePost}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3"
        >
          <textarea
            rows={3}
            maxLength={2000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share a food moment…"
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />

          {showImg && (
            <ImageUpload value={imageUrl} onUpload={(url) => { setImageUrl(url); if (!url) setShowImg(false); }} />
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => { setShowImg((v) => !v); if (showImg) setImageUrl(''); }}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition"
            >
              <Camera className="h-3.5 w-3.5" />
              {showImg ? 'Remove image' : 'Add image'}
            </button>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{content.length}/2000</span>
              <button
                type="submit"
                disabled={!content.trim() || posting}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Post
              </button>
            </div>
          </div>
        </form>

        {/* Loading skeleton */}
        {feedQuery.isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        )}

        {feedQuery.isError && (
          <p className="text-sm text-red-600">Failed to load feed.</p>
        )}

        {/* Posts */}
        {allPosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            isOwn={post.author_id === user?.id}
            onLike={() => likeMut.mutate({ id: post.id, liked: post.liked_by_me })}
            onDelete={() => deleteMut.mutate(post.id)}
          />
        ))}

        {/* Load more */}
        {feedQuery.hasNextPage && (
          <button
            onClick={() => feedQuery.fetchNextPage()}
            disabled={feedQuery.isFetchingNextPage}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition disabled:opacity-60"
          >
            {feedQuery.isFetchingNextPage ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              'Load more'
            )}
          </button>
        )}

        {!feedQuery.isLoading && allPosts.length === 0 && (
          <p className="py-16 text-center text-sm text-gray-400">
            No posts yet. Be the first to share!
          </p>
        )}
      </div>
    </Layout>
  );
}

// ── Post card ──────────────────────────────────────────────────────────────────

function PostCard({
  post,
  isOwn,
  onLike,
  onDelete,
}: {
  post: Post;
  isOwn: boolean;
  onLike: () => void;
  onDelete: () => void;
}) {
  const initials = (post.author_name ?? 'A').slice(0, 2).toUpperCase();

  return (
    <article className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href={`/profile/${post.author_id}`} className="shrink-0">
          {post.author_pic ? (
            <Image
              src={post.author_pic}
              alt={post.author_name ?? 'User'}
              width={36}
              height={36}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
              {initials}
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            href={`/profile/${post.author_id}`}
            className="text-sm font-medium text-gray-900 hover:underline truncate block"
          >
            {post.author_name ?? 'Anonymous'}
          </Link>
          <p className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>

        {isOwn && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
            aria-label="Delete post"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <p className="px-4 pt-3 pb-3 text-sm text-gray-800 whitespace-pre-wrap">{post.content}</p>

      {/* Image — only render HTTPS URLs to prevent IP leaks */}
      {getSafeImageUrl(post.image_url) && (
        <div className="px-4 pb-3">
          <img
            src={getSafeImageUrl(post.image_url)!}
            alt="post image"
            className="w-full rounded-lg object-cover max-h-72"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-1">
        <button
          onClick={onLike}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition',
            post.liked_by_me
              ? 'text-red-500 hover:bg-red-50'
              : 'text-gray-400 hover:text-red-400 hover:bg-red-50'
          )}
        >
          <Heart className={cn('h-4 w-4', post.liked_by_me && 'fill-current')} />
          <span className="tabular-nums">{post.likes_count}</span>
        </button>
      </div>
    </article>
  );
}
